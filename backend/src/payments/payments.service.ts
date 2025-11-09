import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { PaymentMethod, PaymentMethodStatus } from './entities/payment-method.entity';
import { User } from '../users/user.entity';
import { YookassaService } from './yookassa.service';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';
import { FRONTEND_URL } from '../utils/constants';
import { TransactionsService } from './transactions.service';
import { TransactionStatus } from './entities/transaction.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @InjectRepository(PaymentMethod)
    private paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private yookassaService: YookassaService,
    private transactionsService: TransactionsService
  ) {}

  async createSessionPayment(
    userId: string,
    sessionId: string,
    paymentMethodId?: string
  ): Promise<{
    paymentId: string;
    status: PaymentStatus;
    redirectUrl?: string;
    amount: number;
    currency: string;
    transactionId: string;
  }> {
    // 1. Проверяем существование сессии
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['tutor', 'student'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // 2. Проверяем что пользователь - студент этой сессии
    if (session.studentId !== userId) {
      throw new BadRequestException('You can only pay for your own sessions');
    }

    // 3. Проверяем что сессия не оплачена
    const existingPayment = await this.paymentRepository.findOne({
      where: { sessionId, status: PaymentStatus.SUCCESS },
    });

    if (existingPayment) {
      throw new BadRequestException('Session already paid');
    }

    // 4. Проверяем статус сессии
    if (session.status !== SessionStatus.PLANNED && session.status !== SessionStatus.CONFIRMED) {
      throw new BadRequestException('Cannot pay for this session status');
    }

    // 5. Получаем платежный метод
    let paymentMethod: PaymentMethod;
    if (paymentMethodId) {
      paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          id: paymentMethodId,
          userId,
          status: PaymentMethodStatus.ACTIVE,
        },
      });

      if (!paymentMethod) {
        throw new NotFoundException('Payment method not found or not active');
      }
    } else {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['paymentMethods'],
      });

      if (!user?.defaultPaymentMethodId) {
        throw new BadRequestException('No default payment method set');
      }

      paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          id: user.defaultPaymentMethodId,
          userId,
          status: PaymentMethodStatus.ACTIVE,
        },
      });

      if (!paymentMethod) {
        throw new NotFoundException('Default payment method not found');
      }
    }

    // 6. Создаем транзакцию для платежа сессии
    const transaction = await this.transactionsService.createSessionPaymentTransaction(
      userId,
      paymentMethod.id,
      session.price,
      `Оплата сессии с репетитором ${session.tutor.fullName}`
    );

    // 7. Создаем запись платежа в БД
    const payment = this.paymentRepository.create({
      user: { id: userId },
      userId,
      tutor: session.tutor,
      tutorId: session.tutorId,
      session: { id: sessionId },
      sessionId,
      transaction: { id: transaction.id },
      transactionId: transaction.id,
      amount: session.price,
      currency: 'RUB',
      status: PaymentStatus.PENDING,
    });

    const savedPayment = await this.paymentRepository.save(payment);
    this.logger.log(`Payment record created: ${savedPayment.id}, transaction: ${transaction.id}`);

    try {
      // 8. Создаем платеж в ЮКассе
      const yookassaPayment = await this.yookassaService.createSessionPayment({
        amount: session.price,
        paymentMethodToken: paymentMethod.cardToken,
        description: `Оплата сессии с репетитором ${session.tutor.fullName}`,
        paymentId: savedPayment.id,
        returnUrl: `${FRONTEND_URL}/payments/callback`,
      });

      await this.transactionsService.updateTransactionYookassaId(
        transaction.id,
        yookassaPayment.id
      );

      // 9. Обновляем платеж с данными от ЮКассы
      savedPayment.providerPaymentId = yookassaPayment.id;
      savedPayment.status =
        yookassaPayment.status === 'succeeded' ? PaymentStatus.SUCCESS : PaymentStatus.PROCESSING;

      // Обновляем транзакцию с ID из ЮKassa
      transaction.yookassaPaymentId = yookassaPayment.id;
      await this.transactionsService.updateTransactionStatus(
        yookassaPayment.id,
        yookassaPayment.status === 'succeeded'
          ? TransactionStatus.SUCCEEDED
          : TransactionStatus.PENDING
      );

      await this.paymentRepository.save(savedPayment);

      // 10. Если платеж успешен - обновляем сессию
      if (savedPayment.status === PaymentStatus.SUCCESS) {
        await this.sessionRepository.update(sessionId, {
          status: SessionStatus.CONFIRMED,
          paymentId: savedPayment.id,
        });
        this.logger.log(`Session ${sessionId} confirmed after successful payment`);
      }

      return {
        paymentId: savedPayment.id,
        status: savedPayment.status,
        redirectUrl: yookassaPayment.confirmation_url,
        amount: session.price,
        currency: 'RUB',
        transactionId: transaction.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      savedPayment.status = PaymentStatus.FAILED;
      savedPayment.errorMessage = errorMessage;
      await this.paymentRepository.save(savedPayment);

      // Обновляем транзакцию как неудачную
      await this.transactionsService.updateTransactionStatus(
        transaction.yookassaPaymentId || 'unknown',
        TransactionStatus.FAILED,
        errorMessage
      );

      this.logger.error(`Payment failed: ${errorMessage}`);
      throw new InternalServerErrorException(`Payment processing failed: ${errorMessage}`);
    }
  }

  async getPaymentStatus(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
      relations: ['session', 'tutor', 'transaction'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async handlePaymentWebhook(webhookData: YookassaWebhookDto): Promise<void> {
    const { object } = webhookData;

    this.logger.log(`Processing payment webhook: ${object.id}, status: ${object.status}`);

    // Обновляем транзакцию
    await this.transactionsService.handleYookassaWebhook(webhookData);

    // Находим платеж по providerPaymentId (ID из ЮKassa)
    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId: object.id },
      relations: ['session'],
    });

    if (!payment) {
      this.logger.error(`Payment not found for providerPaymentId: ${object.id}`);
      throw new NotFoundException('Payment not found');
    }

    // Обновляем статус платежа
    let newStatus: PaymentStatus;

    switch (object.status) {
      case 'succeeded':
        newStatus = PaymentStatus.SUCCESS;
        break;
      case 'canceled':
        newStatus = PaymentStatus.FAILED;
        break;
      case 'failed':
        newStatus = PaymentStatus.FAILED;
        break;
      case 'pending':
        newStatus = PaymentStatus.PROCESSING;
        break;
      default:
        this.logger.warn(`Unknown payment status: ${object.status}`);
        return;
    }

    // Обновляем платеж
    payment.status = newStatus;
    payment.updatedAt = new Date();

    if (object.status === 'succeeded') {
      payment.paidAt = new Date();
    }

    await this.paymentRepository.save(payment);
    this.logger.log(`Payment ${payment.id} status updated to: ${newStatus}`);

    // Если платеж успешен - подтверждаем сессию
    if (object.status === 'succeeded' && payment.sessionId) {
      await this.sessionRepository.update(payment.sessionId, {
        status: SessionStatus.CONFIRMED,
        paymentId: payment.id,
      });
      this.logger.log(`Session ${payment.sessionId} confirmed after successful payment`);
    }
  }
}
