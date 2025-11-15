import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from './entities/transaction.entity';
import { YookassaService } from './yookassa.service';
import { FRONTEND_URL } from '../utils/constants';
import { YookassaWebhook } from '../utils/types';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private yookassaService: YookassaService
  ) {}

  async createBindTransaction(
    userId: string,
    paymentMethodId: string // ОБЯЗАТЕЛЬНЫЙ параметр
  ): Promise<{
    transaction: Transaction;
    redirectUrl: string;
    yookassaPaymentId: string;
  }> {
    try {
      // Сначала создаем платеж в YooKassa
      const returnUrl = `${FRONTEND_URL}/payment-methods/callback`;
      const { confirmationUrl, paymentId } =
        await this.yookassaService.createPaymentMethodAttachment(returnUrl);

      // Затем создаем транзакцию с paymentMethodId
      const transaction = this.transactionRepository.create({
        userId,
        yookassaPaymentId: paymentId,
        paymentMethodId: paymentMethodId, // УБЕДИТЕСЬ ЧТО ЭТО ЕСТЬ
        amount: 1.0,
        description: 'Привязка карты',
        type: TransactionType.CARD_BINDING,
        status: TransactionStatus.PENDING,
      });

      await this.transactionRepository.save(transaction);

      this.logger.log(
        `Bind transaction created: ${transaction.id} for user ${userId}, ` +
          `payment method: ${paymentMethodId}`
      );

      return {
        transaction,
        redirectUrl: confirmationUrl,
        yookassaPaymentId: paymentId,
      };
    } catch (error) {
      this.logger.error('Failed to create bind transaction', error);
      throw new InternalServerErrorException('Failed to initiate card binding');
    }
  }

  async createSessionPaymentTransaction(
    userId: string,
    paymentMethodId: string,
    amount: number,
    description: string
  ): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      userId,
      paymentMethodId,
      amount,
      description,
      type: TransactionType.SESSION_PAYMENT,
      status: TransactionStatus.PENDING,
      // yookassaPaymentId будет заполнен позже при создании платежа в YooKassa
    });

    return await this.transactionRepository.save(transaction);
  }

  async updateTransactionYookassaId(
    transactionId: string,
    yookassaPaymentId: string
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    transaction.yookassaPaymentId = yookassaPaymentId;
    return await this.transactionRepository.save(transaction);
  }

  async updateTransactionStatus(
    yookassaPaymentId: string,
    status: TransactionStatus,
    errorReason?: string
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { yookassaPaymentId },
    });

    if (!transaction) {
      this.logger.warn(`Transaction not found for payment ID: ${yookassaPaymentId}`);
      return null;
    }

    transaction.status = status;
    if (errorReason) {
      transaction.errorReason = errorReason;
    }

    const savedTransaction = await this.transactionRepository.save(transaction);
    this.logger.log(`Transaction ${savedTransaction.id} status updated to: ${status}`);

    return savedTransaction;
  }

  async getTransactionByYookassaId(yookassaPaymentId: string): Promise<Transaction> {
    return this.transactionRepository.findOne({
      where: { yookassaPaymentId },
      relations: ['user', 'paymentMethod'],
    });
  }

  async getTransactionById(id: string): Promise<Transaction> {
    return this.transactionRepository.findOne({
      where: { id },
      relations: ['user', 'paymentMethod'],
    });
  }

  async findUserTransactions(userId: string, type?: TransactionType): Promise<Transaction[]> {
    const where: Record<string, unknown> = { userId };
    if (type) {
      where.type = type;
    }

    return this.transactionRepository.find({
      where,
      relations: ['paymentMethod'],
      order: { createdAt: 'DESC' },
    });
  }

  private mapYookassaStatusToTransactionStatus(yookassaStatus: string): TransactionStatus {
    switch (yookassaStatus) {
      case 'succeeded':
        return TransactionStatus.SUCCEEDED;
      case 'canceled':
        return TransactionStatus.CANCELED;
      case 'waiting_for_capture':
        return TransactionStatus.WAITING_FOR_CAPTURE;
      case 'failed':
        return TransactionStatus.FAILED;
      case 'pending':
        return TransactionStatus.PENDING;
      default:
        this.logger.warn(`Unknown YooKassa status: ${yookassaStatus}`);
        return TransactionStatus.PENDING;
    }
  }

  async handleYookassaWebhook(webhookData: YookassaWebhook): Promise<Transaction> {
    const { object } = webhookData;

    const transactionStatus = this.mapYookassaStatusToTransactionStatus(object.status);

    return await this.updateTransactionStatus(
      object.id,
      transactionStatus,
      object.error?.message || object.cancellation_details?.reason || null
    );
  }
}
