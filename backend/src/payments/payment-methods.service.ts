import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { FRONTEND_URL } from '../utils/constants';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';

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
    private configService: ConfigService
  ) {}

  async attachPaymentMethod(
    userId: string,
    provider: PaymentProvider = PaymentProvider.YOOKASSA
  ): Promise<{ confirmationUrl: string; attachmentId: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const returnUrl = `${FRONTEND_URL}/payment-methods/callback`;
    const { confirmationUrl, paymentId } =
      await this.yookassaService.createPaymentMethodAttachment(returnUrl);

    const paymentMethod = this.paymentMethodRepository.create({
      user,
      userId: user.id,
      provider,
      cardMasked: 'pending',
      cardToken: paymentId,
      status: PaymentMethodStatus.PENDING,
    });

    await this.paymentMethodRepository.save(paymentMethod);

    this.logger.log(
      `Payment method attachment initiated for user ${userId}, payment ID: ${paymentId}`
    );

    return {
      confirmationUrl,
      attachmentId: paymentMethod.id,
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

  async handleWebhook(webhookData: YookassaWebhookDto): Promise<void> {
    try {
      const webhookResult = this.yookassaService.handlePaymentMethodWebhook(webhookData);

      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          cardToken: webhookResult.paymentId,
          status: PaymentMethodStatus.PENDING,
        },
        relations: ['user'],
      });

      if (!paymentMethod) {
        this.logger.warn(`Payment method not found for payment ID: ${webhookResult.paymentId}`);
        return;
      }

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

  async getPaymentMethodById(id: string): Promise<PaymentMethod> {
    return this.paymentMethodRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  private async updatePaymentMethodOnSuccess(
    paymentMethod: PaymentMethod,
    yookassaPaymentMethodId: string,
    cardDetails?: CardDetails
  ): Promise<void> {
    paymentMethod.cardToken = yookassaPaymentMethodId;
    paymentMethod.yookassaPaymentId = paymentMethod.cardToken;
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
