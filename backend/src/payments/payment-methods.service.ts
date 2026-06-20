import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentMethod,
  PaymentMethodStatus,
  PaymentProvider,
} from './entities/payment-method.entity';
import { User } from '../users/user.entity';
import { YookassaService } from './yookassa.service';
import { Payment } from './entities/payment.entity';
import { CardDetails } from '../utils/types';
// import { FRONTEND_URL } from '../utils/constants';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';
import { TransactionStatus, TransactionType } from './entities/transaction.entity';
import { ConfigService } from '@nestjs/config';
import { TransactionsService } from './transactions.service';

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(
    @InjectRepository(PaymentMethod)
    private paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private yookassaService: YookassaService,
    private transactionsService: TransactionsService,
    private configService: ConfigService
  ) {}

  async attachPaymentMethod(
    userId: string,
    provider: PaymentProvider = PaymentProvider.YOOKASSA
  ): Promise<{ confirmationUrl: string; transactionId: string; yookassaPaymentId: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activeCardsCount = await this.paymentMethodRepository.count({
      where: {
        userId,
        status: PaymentMethodStatus.ACTIVE,
      },
    });

    if (activeCardsCount >= 1) {
      throw new ConflictException('Можно привязать только одну карту. Удалите текущую, чтобы привязать другую.');
    }

    const paymentMethod = this.paymentMethodRepository.create({
      user,
      userId: user.id,
      provider,
      cardMasked: 'pending',
      cardToken: 'pending',
      status: PaymentMethodStatus.PENDING,
    });

    const savedPaymentMethod = await this.paymentMethodRepository.save(paymentMethod);

    const { transaction, redirectUrl, yookassaPaymentId } =
      await this.transactionsService.createBindTransaction(userId, savedPaymentMethod.id, user.email);

    savedPaymentMethod.cardToken = yookassaPaymentId;
    savedPaymentMethod.yookassaPaymentId = yookassaPaymentId;
    savedPaymentMethod.bindTransactionId = transaction.id;
    await this.paymentMethodRepository.save(savedPaymentMethod);

    this.logger.log(
      `Payment method attachment initiated for user ${userId}, ` +
        `transaction: ${transaction.id}, ` +
        `payment method: ${savedPaymentMethod.id}, ` +
        `yookassa payment: ${yookassaPaymentId}`
    );

    return {
      confirmationUrl: redirectUrl,
      transactionId: transaction.id,
      yookassaPaymentId,
    };
  }

  async findByUserId(userId: string): Promise<PaymentMethod[]> {
    return this.paymentMethodRepository.find({
      where: {
        userId,
        status: PaymentMethodStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async handleWebhook(webhookData: YookassaWebhookDto): Promise<void> {
    try {
      const webhookResult = this.yookassaService.handlePaymentMethodWebhook(webhookData);

      const transactionStatus = this.mapToTransactionStatus(webhookResult.status);
      const updatedTransaction = await this.transactionsService.updateTransactionStatus(
        webhookResult.paymentId,
        transactionStatus,
        webhookResult.status === 'failed' ? 'Payment failed' : null
      );

      let paymentMethod = await this.paymentMethodRepository.findOne({
        where: [
          { cardToken: webhookResult.paymentId, status: PaymentMethodStatus.PENDING },
          { yookassaPaymentId: webhookResult.paymentId, status: PaymentMethodStatus.PENDING },
        ],
        relations: ['user'],
      });

      if (!paymentMethod && updatedTransaction) {
        paymentMethod = await this.paymentMethodRepository.findOne({
          where: {
            bindTransactionId: updatedTransaction.id,
          },
          relations: ['user'],
        });
      }

      if (!paymentMethod) {
        this.logger.warn(`Payment method not found for payment ID: ${webhookResult.paymentId}`);
        this.logger.debug(`Searching for payment methods with:`, {
          cardToken: webhookResult.paymentId,
          yookassaPaymentId: webhookResult.paymentId,
          transactionId: updatedTransaction?.id,
        });
        return;
      }

      this.logger.log(
        `Found payment method: ${paymentMethod.id} for payment: ${webhookResult.paymentId}`
      );

      if (webhookData.object.status === 'waiting_for_capture') {
        await this.yookassaService.capturePayment(webhookResult.paymentId);
      }

      if (webhookResult.status === 'succeeded' && webhookResult.paymentMethodId) {
        await this.updatePaymentMethodOnSuccess(
          paymentMethod,
          webhookResult.paymentMethodId,
          webhookResult.cardDetails
        );
      } else {
        await this.updatePaymentMethodOnFailure(paymentMethod, webhookResult.status);
      }
    } catch (error) {
      this.logger.error('Error handling webhook', error);
      throw new InternalServerErrorException('Failed to process webhook');
    }
  }

  private mapToTransactionStatus(status: string): TransactionStatus {
    switch (status) {
      case 'succeeded':
        return TransactionStatus.SUCCEEDED;
      case 'canceled':
        return TransactionStatus.CANCELED;
      case 'waiting_for_capture':
        return TransactionStatus.WAITING_FOR_CAPTURE;
      case 'failed':
        return TransactionStatus.FAILED;
      default:
        return TransactionStatus.PENDING;
    }
  }

  private async updatePaymentMethodOnSuccess(
    paymentMethod: PaymentMethod,
    yookassaPaymentMethodId: string,
    cardDetails?: CardDetails
  ): Promise<void> {
    if (paymentMethod.status === PaymentMethodStatus.ACTIVE) {
      this.logger.log(`Payment method ${paymentMethod.id} already activated, skipping`);
      return;
    }

    paymentMethod.cardToken = yookassaPaymentMethodId;
    paymentMethod.yookassaPaymentId = yookassaPaymentMethodId;
    paymentMethod.status = PaymentMethodStatus.ACTIVE;

    if (cardDetails) {
      paymentMethod.cardMasked = `${cardDetails.first6}******${cardDetails.last4}`;
      paymentMethod.cardType = cardDetails.cardType;
      paymentMethod.expiryMonth = cardDetails.expiryMonth;
      paymentMethod.expiryYear = cardDetails.expiryYear;
    }

    await this.paymentMethodRepository.save(paymentMethod);

    const userPaymentMethods = await this.paymentMethodRepository.find({
      where: {
        userId: paymentMethod.userId,
        status: PaymentMethodStatus.ACTIVE,
      },
    });

    if (userPaymentMethods.length === 1) {
      await this.userRepository.update(paymentMethod.userId, {
        defaultPaymentMethodId: paymentMethod.id,
      });
      this.logger.log(
        `Set payment method ${paymentMethod.id} as default for user ${paymentMethod.userId}`
      );
    }

    this.logger.log(
      `Payment method ${paymentMethod.id} successfully activated for user ${paymentMethod.userId}`
    );
  }

  private async updatePaymentMethodOnFailure(
    paymentMethod: PaymentMethod,
    status: string
  ): Promise<void> {
    paymentMethod.status = PaymentMethodStatus.DELETED;
    await this.paymentMethodRepository.save(paymentMethod);

    this.logger.warn(`Payment method ${paymentMethod.id} failed with status: ${status}`);
  }

  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<{
    success: boolean;
    message: string;
    paymentMethodId: string;
    isDefault: boolean;
  }> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: {
        id: paymentMethodId,
        userId,
        status: PaymentMethodStatus.ACTIVE,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found or not active');
    }

    await this.userRepository.update(userId, {
      defaultPaymentMethodId: paymentMethodId,
    });

    this.logger.log(`Default payment method set to ${paymentMethodId} for user ${userId}`);

    return {
      success: true,
      message: 'Payment method set as default successfully',
      paymentMethodId,
      isDefault: true,
    };
  }

  async getPaymentMethodById(id: string): Promise<PaymentMethod> {
    return this.paymentMethodRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async deletePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<{
    success: boolean;
    message: string;
    defaultPaymentMethodUpdated: boolean;
  }> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: {
        id: paymentMethodId,
        userId,
        status: PaymentMethodStatus.ACTIVE,
      },
      relations: ['user'],
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found or already deleted');
    }

    const hasActivePayments = await this.checkPaymentMethodUsage(paymentMethodId);
    if (hasActivePayments) {
      throw new BadRequestException('Cannot delete payment method with active payments');
    }

    let defaultPaymentMethodUpdated = false;

    if (paymentMethod.user.defaultPaymentMethodId === paymentMethodId) {
      await this.userRepository.update(userId, {
        defaultPaymentMethodId: null,
      });
      defaultPaymentMethodUpdated = true;
      this.logger.log(`Default payment method reset for user ${userId}`);
    }

    paymentMethod.status = PaymentMethodStatus.DELETED;
    await this.paymentMethodRepository.save(paymentMethod);

    this.logger.log(`Payment method ${paymentMethodId} deleted for user ${userId}`);

    return {
      success: true,
      message: 'Payment method successfully deleted',
      defaultPaymentMethodUpdated,
    };
  }

  private async checkPaymentMethodUsage(paymentMethodId: string): Promise<boolean> {
    const activePayments = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.user', 'user')
      .innerJoin('user.paymentMethods', 'paymentMethod')
      .where('paymentMethod.id = :paymentMethodId', { paymentMethodId })
      .andWhere('payment.status IN (:...activeStatuses)', {
        activeStatuses: ['pending', 'processing'],
      })
      .getCount();

    return activePayments > 0;
  }

  /**
   * Called when the user's browser is redirected back from YooKassa after 3DS card binding.
   * Updates cardToken to the real saved payment_method_id and activates the payment method.
   * Returns the frontend URL to redirect the user to.
   */
  async handleBindingCallback(transactionId: string): Promise<string> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://platformaapp.ru');

    try {
      const transaction = await this.transactionsService.getTransactionById(transactionId);

      if (!transaction || transaction.type !== TransactionType.CARD_BINDING) {
        this.logger.warn(`Invalid or missing card binding transaction: ${transactionId}`);
        return `${frontendUrl}/payment-methods?status=error`;
      }

      if (!transaction.yookassaPaymentId) {
        this.logger.warn(`Transaction ${transactionId} has no yookassaPaymentId yet`);
        return `${frontendUrl}/payment-methods?status=error`;
      }

      let yookassaPayment = await this.yookassaService.getPayment(transaction.yookassaPaymentId);
      this.logger.log(
        `Card binding callback: tx=${transactionId}, yk_payment=${transaction.yookassaPaymentId}, status=${yookassaPayment.status}`
      );

      // Payment still processing — don't destroy the card record, webhook will activate it later
      if (yookassaPayment.status === 'pending') {
        this.logger.log(`Payment ${transaction.yookassaPaymentId} still pending at callback time, waiting for webhook`);
        return `${frontendUrl}/payment-methods?status=pending&tx=${transactionId}`;
      }

      if (yookassaPayment.status === 'waiting_for_capture') {
        await this.yookassaService.capturePayment(transaction.yookassaPaymentId);
        // Re-fetch to get payment_method.id populated after capture
        yookassaPayment = await this.yookassaService.getPayment(transaction.yookassaPaymentId);
        this.logger.log(`After capture: status=${yookassaPayment.status}, payment_method_id=${yookassaPayment.payment_method?.id}`);
      }

      if (
        yookassaPayment.status === 'succeeded' ||
        yookassaPayment.status === 'waiting_for_capture'
      ) {
        const paymentMethod = await this.paymentMethodRepository.findOne({
          where: { bindTransactionId: transaction.id },
        });

        if (paymentMethod && yookassaPayment.payment_method?.id) {
          const card = yookassaPayment.payment_method.card;
          await this.updatePaymentMethodOnSuccess(
            paymentMethod,
            yookassaPayment.payment_method.id,
            card
              ? {
                  first6: card.first6,
                  last4: card.last4,
                  cardType: card.card_type,
                  expiryMonth: card.expiry_month,
                  expiryYear: card.expiry_year,
                }
              : undefined
          );
        } else {
          this.logger.warn(`payment_method.id missing after capture for tx=${transactionId}, will wait for webhook`);
        }

        return `${frontendUrl}/payment-methods?status=success`;
      }

      // Explicitly failed or canceled — safe to mark as deleted
      this.logger.warn(`Card binding failed: tx=${transactionId}, status=${yookassaPayment.status}`);
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: { bindTransactionId: transaction.id },
      });
      if (paymentMethod) {
        await this.updatePaymentMethodOnFailure(paymentMethod, yookassaPayment.status);
      }

      return `${frontendUrl}/payment-methods?status=failed`;
    } catch (error) {
      this.logger.error(`Card binding callback error for tx ${transactionId}: ${(error as Error).message}`);
      return `${frontendUrl}/payment-methods?status=error`;
    }
  }

  async getBindingStatus(transactionId: string): Promise<{
    status: 'active' | 'pending' | 'failed' | 'not_found';
    cardMasked?: string;
    cardType?: string;
  }> {
    const transaction = await this.transactionsService.getTransactionById(transactionId);
    if (!transaction) return { status: 'not_found' };

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { bindTransactionId: transaction.id },
    });
    if (!paymentMethod) return { status: 'not_found' };

    if (paymentMethod.status === PaymentMethodStatus.ACTIVE) {
      return {
        status: 'active',
        cardMasked: paymentMethod.cardMasked,
        cardType: paymentMethod.cardType,
      };
    }

    if (paymentMethod.status === PaymentMethodStatus.DELETED) {
      return { status: 'failed' };
    }

    // Still PENDING — check live status from YooKassa
    if (transaction.yookassaPaymentId) {
      try {
        const ykPayment = await this.yookassaService.getPayment(transaction.yookassaPaymentId);
        if (ykPayment.status === 'succeeded' || ykPayment.status === 'waiting_for_capture') {
          // Try to activate now
          if (ykPayment.status === 'waiting_for_capture') {
            await this.yookassaService.capturePayment(transaction.yookassaPaymentId);
          }
          const refreshed = await this.yookassaService.getPayment(transaction.yookassaPaymentId);
          if (refreshed.payment_method?.id) {
            const card = refreshed.payment_method.card;
            await this.updatePaymentMethodOnSuccess(paymentMethod, refreshed.payment_method.id,
              card ? { first6: card.first6, last4: card.last4, cardType: card.card_type, expiryMonth: card.expiry_month, expiryYear: card.expiry_year } : undefined
            );
            return { status: 'active', cardMasked: paymentMethod.cardMasked, cardType: paymentMethod.cardType };
          }
        }
        if (ykPayment.status === 'canceled' || ykPayment.status === 'failed') {
          await this.updatePaymentMethodOnFailure(paymentMethod, ykPayment.status);
          return { status: 'failed' };
        }
      } catch (e) {
        this.logger.error(`getBindingStatus: failed to fetch YooKassa payment: ${(e as Error).message}`);
      }
    }

    return { status: 'pending' };
  }

  async getDefaultPaymentMethod(userId: string): Promise<PaymentMethod | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['paymentMethods'],
    });

    if (!user || !user.defaultPaymentMethodId) {
      return null;
    }

    return this.paymentMethodRepository.findOne({
      where: {
        id: user.defaultPaymentMethodId,
        userId,
        status: PaymentMethodStatus.ACTIVE,
      },
    });
  }
}
