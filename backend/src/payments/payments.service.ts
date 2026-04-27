import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { PaymentMethod, PaymentMethodStatus } from './entities/payment-method.entity';
import { User } from '../users/user.entity';
import { YookassaService } from './yookassa.service';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';
import { ConfigService } from '@nestjs/config';
import { TransactionsService } from './transactions.service';
import { TransactionStatus, TransactionType } from './entities/transaction.entity';
import { UserEvent, ParticipationStatus, PaymentStatus as UserEventPaymentStatus } from 'src/events/entities/user-event.entity';
import { Event } from 'src/events/entities/event.entity';

/** Строка истории платежей в профиле (сессии + мероприятия). */
export type StudentPaymentHistoryItem = {
  id: string;
  kind: 'session' | 'event';
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  paidAt: Date | null;
  sessionId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  counterpartyName: string | null;
  errorMessage: string | null;
};

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
    private transactionsService: TransactionsService,
    private configService: ConfigService,
    @InjectRepository(UserEvent)
    private userEventRepository: Repository<UserEvent>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>
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
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['tutor', 'student'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.studentId !== userId) {
      throw new BadRequestException('You can only pay for your own sessions');
    }

    const existingPayment = await this.paymentRepository.findOne({
      where: { sessionId, status: PaymentStatus.SUCCESS },
    });

    if (existingPayment) {
      throw new BadRequestException('Session already paid');
    }

    if (session.status !== SessionStatus.PLANNED && session.status !== SessionStatus.CONFIRMED) {
      throw new BadRequestException('Cannot pay for this session status');
    }

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

    const transaction = await this.transactionsService.createSessionPaymentTransaction(
      userId,
      paymentMethod.id,
      session.price,
      `Оплата сессии с репетитором ${session.tutor.fullName}`
    );

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
      const yookassaPayment = await this.yookassaService.createSessionPayment({
        amount: session.price,
        paymentMethodToken: paymentMethod.cardToken,
        description: `Оплата сессии с репетитором ${session.tutor.fullName}`,
        paymentId: savedPayment.id,
        returnUrl: `${this.configService.get<string>('FRONTEND_URL')}/payments/callback`,
      });

      await this.transactionsService.updateTransactionYookassaId(
        transaction.id,
        yookassaPayment.id
      );

      savedPayment.providerPaymentId = yookassaPayment.id;
      savedPayment.status =
        yookassaPayment.status === 'succeeded' ? PaymentStatus.SUCCESS : PaymentStatus.PROCESSING;

      transaction.yookassaPaymentId = yookassaPayment.id;
      await this.transactionsService.updateTransactionStatus(
        yookassaPayment.id,
        yookassaPayment.status === 'succeeded'
          ? TransactionStatus.SUCCEEDED
          : TransactionStatus.PENDING
      );

      await this.paymentRepository.save(savedPayment);

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

  /** История для профиля: оплаты сессий (таблица payments) + оплаченные мероприятия (user_events), т.к. события раньше не создавали запись в payments. */
  async getStudentPayments(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{
    data: StudentPaymentHistoryItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [sessionPayments, allEvents] = await Promise.all([
      this.paymentRepository.find({
        where: { userId },
        relations: ['session', 'tutor'],
        order: { createdAt: 'DESC' },
      }),
      this.userEventRepository.find({
        where: { userId },
        relations: ['event', 'event.mentor'],
        order: { updatedAt: 'DESC' },
      }),
    ]);

    const sessionItems = sessionPayments.map((p) => ({
      row: {
        id: p.id,
        kind: 'session' as const,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        paidAt: p.paidAt ?? null,
        sessionId: p.sessionId ?? null,
        eventId: null,
        eventTitle: null,
        counterpartyName: p.tutor?.fullName ?? null,
        errorMessage: p.errorMessage ?? null,
      } satisfies StudentPaymentHistoryItem,
      sortAt: p.paidAt ?? p.createdAt,
    }));

    const eventItems = allEvents.map((ue) => {
      const ev = ue.event;
      const isPaid = ue.paymentStatus === UserEventPaymentStatus.PAID;
      return {
        row: {
          id: ue.id,
          kind: 'event' as const,
          amount: ev ? Number(ev.price) : 0,
          currency: 'RUB',
          status: isPaid ? PaymentStatus.SUCCESS : (PaymentStatus.PENDING as PaymentStatus),
          createdAt: ue.createdAt,
          paidAt: isPaid ? ue.updatedAt : null,
          sessionId: null,
          eventId: ue.eventId,
          eventTitle: ev?.title ?? null,
          counterpartyName: ev?.mentor?.fullName ?? null,
          errorMessage: null,
        } satisfies StudentPaymentHistoryItem,
        sortAt: ue.createdAt,
      };
    });

    const merged = [...sessionItems, ...eventItems].sort(
      (a, b) => b.sortAt.getTime() - a.sortAt.getTime()
    );

    const total = merged.length;
    const data = merged.slice(skip, skip + limit).map((m) => m.row);

    return { data, total, page, limit };
  }

  async handlePaymentWebhook(webhookData: YookassaWebhookDto): Promise<void> {
    const { object } = webhookData;

    this.logger.log(`Processing payment webhook: ${object.id}, status: ${object.status}`);

    await this.transactionsService.handleYookassaWebhook(webhookData);

    const payment = await this.paymentRepository.findOne({
      where: { providerPaymentId: object.id },
      relations: ['session'],
    });

    if (!payment) {
      // Платёж мероприятия не создаёт запись в таблице payments.
      // Идентификатор user_event передаётся в metadata.payment_id.
      const metadataPaymentId = (object.metadata as Record<string, string> | undefined)
        ?.payment_id;
      if (metadataPaymentId) {
        if (object.status === 'succeeded') {
          await this.userEventRepository.update(metadataPaymentId, {
            paymentStatus: UserEventPaymentStatus.PAID,
            status: ParticipationStatus.REGISTERED,
          });
          this.logger.log(`UserEvent ${metadataPaymentId} marked as PAID via webhook`);
        } else {
          this.logger.log(
            `Event payment webhook with status ${object.status} for userEvent ${metadataPaymentId}, no action needed`
          );
        }
        return;
      }
      this.logger.error(`Payment not found for providerPaymentId: ${object.id}`);
      throw new NotFoundException('Payment not found');
    }

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

    payment.status = newStatus;
    payment.updatedAt = new Date();

    if (object.status === 'succeeded') {
      payment.paidAt = new Date();
    }

    await this.paymentRepository.save(payment);
    this.logger.log(`Payment ${payment.id} status updated to: ${newStatus}`);

    if (object.status === 'succeeded' && payment.sessionId) {
      await this.sessionRepository.update(payment.sessionId, {
        status: SessionStatus.CONFIRMED,
        paymentId: payment.id,
      });
      this.logger.log(`Session ${payment.sessionId} confirmed after successful payment`);
    }
  }

  async handlePaymentCallback(paymentId: string): Promise<{
    message: string;
    paymentId: string;
    redirectUrl: string;
  }> {
    this.logger.log(`Handling payment callback for: ${paymentId}`);

    try {
      const yookassaPayment = await this.yookassaService.getPayment(paymentId);

      const transaction = await this.transactionsService.getTransactionByYookassaId(paymentId);

      if (!transaction) {
        throw new NotFoundException(`Transaction not found for payment: ${paymentId}`);
      }

      switch (yookassaPayment.status) {
        case 'succeeded': {
          await this.transactionsService.updateTransactionStatus(
            paymentId,
            TransactionStatus.SUCCEEDED
          );

          if (transaction.type === TransactionType.CARD_BINDING) {
            const paymentMethod = await this.paymentMethodRepository.findOne({
              where: {
                bindTransactionId: transaction.id,
                status: PaymentMethodStatus.PENDING,
              },
            });

            if (paymentMethod && yookassaPayment.payment_method?.id) {
              paymentMethod.cardToken = yookassaPayment.payment_method.id;
              paymentMethod.status = PaymentMethodStatus.ACTIVE;

              if (yookassaPayment.payment_method.card) {
                const card = yookassaPayment.payment_method.card;
                paymentMethod.cardMasked = `${card.first6}******${card.last4}`;
                paymentMethod.cardType = card.card_type;
                paymentMethod.expiryMonth = card.expiry_month;
                paymentMethod.expiryYear = card.expiry_year;
              }

              await this.paymentMethodRepository.save(paymentMethod);

              const userCards = await this.paymentMethodRepository.count({
                where: {
                  userId: transaction.userId,
                  status: PaymentMethodStatus.ACTIVE,
                },
              });

              if (userCards === 1) {
                await this.userRepository.update(transaction.userId, {
                  defaultPaymentMethodId: paymentMethod.id,
                });
              }

              this.logger.log(`Payment method ${paymentMethod.id} activated via callback`);
            }
          }

          if (transaction.type === TransactionType.SESSION_PAYMENT) {
            const payment = await this.paymentRepository.findOne({
              where: { transactionId: transaction.id },
              relations: ['session'],
            });

            if (payment) {
              payment.status = PaymentStatus.SUCCESS;
              payment.paidAt = new Date();
              await this.paymentRepository.save(payment);

              if (payment.sessionId) {
                await this.sessionRepository.update(payment.sessionId, {
                  status: SessionStatus.CONFIRMED,
                  paymentId: payment.id,
                });
              }
            }
          }

          let redirectUrl: string;

          const frontendUrl = this.configService.get<string>('FRONTEND_URL');
          if (transaction.type === TransactionType.CARD_BINDING) {
            redirectUrl = `${frontendUrl}/payment-methods?status=success`;
          } else {
            const payment = await this.paymentRepository.findOne({
              where: { transactionId: transaction.id },
            });

            const sessionId = payment?.sessionId || '';
            redirectUrl = `${frontendUrl}/sessions/${sessionId}?payment=success`;
          }
          return {
            message:
              transaction.type === TransactionType.CARD_BINDING
                ? 'Карта успешно привязана'
                : 'Платеж успешно завершен',
            paymentId: transaction.id,
            redirectUrl: redirectUrl,
          };
        }

        case 'canceled':
        case 'failed':
          await this.transactionsService.updateTransactionStatus(
            paymentId,
            TransactionStatus.FAILED,
            yookassaPayment.cancellation_details?.reason || 'Payment failed'
          );

          if (transaction.type === TransactionType.CARD_BINDING) {
            await this.paymentMethodRepository.update(
              { bindTransactionId: transaction.id },
              { status: PaymentMethodStatus.DELETED }
            );
          }

          throw new BadRequestException(
            yookassaPayment.cancellation_details?.reason || 'Платеж отменен'
          );

        case 'waiting_for_capture': {
          await this.yookassaService.capturePayment(paymentId);

          await this.transactionsService.updateTransactionStatus(
            paymentId,
            TransactionStatus.SUCCEEDED
          );

          let captureRedirectUrl: string;

          if (transaction.type === TransactionType.CARD_BINDING) {
            const paymentMethod = await this.paymentMethodRepository.findOne({
              where: {
                bindTransactionId: transaction.id,
                status: PaymentMethodStatus.PENDING,
              },
            });

            if (paymentMethod && yookassaPayment.payment_method?.id) {
              paymentMethod.cardToken = yookassaPayment.payment_method.id;
              paymentMethod.status = PaymentMethodStatus.ACTIVE;

              if (yookassaPayment.payment_method.card) {
                const card = yookassaPayment.payment_method.card;
                paymentMethod.cardMasked = `${card.first6}******${card.last4}`;
                paymentMethod.cardType = card.card_type;
                paymentMethod.expiryMonth = card.expiry_month;
                paymentMethod.expiryYear = card.expiry_year;
              }

              await this.paymentMethodRepository.save(paymentMethod);

              const userCards = await this.paymentMethodRepository.count({
                where: {
                  userId: transaction.userId,
                  status: PaymentMethodStatus.ACTIVE,
                },
              });

              if (userCards === 1) {
                await this.userRepository.update(transaction.userId, {
                  defaultPaymentMethodId: paymentMethod.id,
                });
              }

              this.logger.log(
                `Payment method ${paymentMethod.id} activated via waiting_for_capture callback`
              );
            }

            captureRedirectUrl = `${this.configService.get<string>('FRONTEND_URL')}/payment-methods?status=success`;
          } else {
            captureRedirectUrl = `${this.configService.get<string>('FRONTEND_URL')}/payments/status?payment_id=${paymentId}`;
          }

          return {
            message:
              transaction.type === TransactionType.CARD_BINDING
                ? 'Карта успешно привязана'
                : 'Платеж требует подтверждения',
            paymentId: transaction.id,
            redirectUrl: captureRedirectUrl,
          };
        }

        case 'pending':
          return {
            message: 'Платеж обрабатывается',
            paymentId: transaction.id,
            redirectUrl: `${this.configService.get<string>('FRONTEND_URL')}/payments/status?payment_id=${paymentId}`,
          };

        default:
          this.logger.warn(`Unknown payment status: ${yookassaPayment.status}`);
          throw new BadRequestException('Неизвестный статус платежа');
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown Error';

      this.logger.error(`Error processing payment callback: ${errorMessage}`);

      await this.transactionsService.updateTransactionStatus(
        paymentId,
        TransactionStatus.FAILED,
        errorMessage
      );

      throw new InternalServerErrorException(`Payment processing error: ${errorMessage}`);
    }
  }

  async syncEventPaymentStatus(
    userId: string,
    eventId: string,
    yookassaPaymentIdParam?: string
  ): Promise<{ paymentStatus: string; synced: boolean }> {
    const userEvent = await this.userEventRepository.findOne({
      where: { eventId, userId },
    });

    if (!userEvent) {
      throw new NotFoundException('Регистрация на событие не найдена');
    }

    if (userEvent.paymentStatus === UserEventPaymentStatus.PAID) {
      return { paymentStatus: 'paid', synced: false };
    }

    const effectiveYookassaId = userEvent.yookassaPaymentId ?? yookassaPaymentIdParam;

    if (!effectiveYookassaId) {
      return { paymentStatus: userEvent.paymentStatus, synced: false };
    }

    // If we got the ID from the query param but it wasn't stored in DB, persist it now
    if (!userEvent.yookassaPaymentId && yookassaPaymentIdParam) {
      try {
        await this.userEventRepository.update(userEvent.id, { yookassaPaymentId: yookassaPaymentIdParam });
      } catch (dbErr) {
        this.logger.warn(`Could not persist yookassaPaymentId from query param: ${(dbErr as Error).message}`);
      }
    }

    const yookassaPayment = await this.yookassaService.getPayment(effectiveYookassaId);
    this.logger.log(
      `Syncing event payment ${effectiveYookassaId}: YooKassa status = ${yookassaPayment.status}`
    );

    if (yookassaPayment.status === 'succeeded') {
      await this.userEventRepository.update(userEvent.id, {
        paymentStatus: UserEventPaymentStatus.PAID,
        status: ParticipationStatus.REGISTERED,
      });
      return { paymentStatus: 'paid', synced: true };
    }

    if (yookassaPayment.status === 'canceled' || yookassaPayment.status === 'failed') {
      await this.userEventRepository.update(userEvent.id, {
        paymentStatus: UserEventPaymentStatus.FAILED,
      });
      return { paymentStatus: 'failed', synced: true };
    }

    return { paymentStatus: yookassaPayment.status, synced: false };
  }

  async createEventPayment(
    userId: string,
    eventId: string,
    paymentMethodId?: string
  ): Promise<{ confirmationUrl?: string; status: string; message: string; yookassaPaymentId?: string }> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['mentor'],
    });

    if (!event) throw new NotFoundException('Событие не найдено');
    if (event.price <= 0) throw new BadRequestException('Событие бесплатное, оплата не требуется');

    const userEvent = await this.userEventRepository.findOne({
      where: { eventId, userId },
    });

    if (!userEvent) throw new BadRequestException('Вы не зарегистрированы на это событие');
    if (userEvent.paymentStatus === UserEventPaymentStatus.PAID) {
      throw new BadRequestException('Событие уже оплачено');
    }

    // Resolve payment method — try to auto-heal PENDING methods whose webhook was never received.
    let paymentMethod = await this.resolvePaymentMethod(userId, paymentMethodId);

    const returnUrl = `${this.configService.get<string>('FRONTEND_URL')}/events/${eventId}?payment=callback`;

    let yookassaPayment: { id: string; status: string; confirmation_url?: string };

    try {
      this.logger.log(
        `Creating YooKassa payment for event ${eventId}: pm=${paymentMethod.id}, cardToken_prefix=${paymentMethod.cardToken?.substring(0, 8)}...`
      );
      yookassaPayment = await this.yookassaService.createSessionPayment({
        amount: Number(event.price),
        paymentMethodToken: paymentMethod.cardToken,
        description: `Оплата мероприятия: ${event.title}`,
        paymentId: userEvent.id,
        returnUrl,
      });
      this.logger.log(
        `YooKassa payment created for event ${eventId}: id=${yookassaPayment.id}, status=${yookassaPayment.status}, has_confirmation_url=${!!yookassaPayment.confirmation_url}`
      );
    } catch (firstError) {
      const firstMsg = firstError instanceof Error ? firstError.message : String(firstError);
      this.logger.error(`YooKassa API call failed for event ${eventId} (cardToken_prefix=${paymentMethod.cardToken?.substring(0, 8)}...): ${firstMsg}`);

      // Recovery attempt: cardToken might still be the 1-rub payment ID (not the saved method ID).
      // Query the original payment to extract the real payment_method_id and retry once.
      const recovered = await this.tryRecoverCardToken(paymentMethod);
      if (recovered) {
        try {
          yookassaPayment = await this.yookassaService.createSessionPayment({
            amount: Number(event.price),
            paymentMethodToken: paymentMethod.cardToken,
            description: `Оплата мероприятия: ${event.title}`,
            paymentId: userEvent.id,
            returnUrl,
          });
          this.logger.log(`YooKassa payment created after cardToken recovery: id=${yookassaPayment.id}, status=${yookassaPayment.status}`);
        } catch (retryError) {
          const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
          this.logger.error(`YooKassa retry also failed after recovery: ${retryMsg}`);
          throw new InternalServerErrorException(`Ошибка создания платежа: ${retryMsg}`);
        }
      } else {
        throw new InternalServerErrorException(`Ошибка создания платежа: ${firstMsg}`);
      }
    }

    // Store YooKassa payment ID for later status polling.
    // Isolated from the main flow — if the column doesn't exist yet (migration pending),
    // we still return the confirmationUrl so the user can complete 3DS.
    try {
      await this.userEventRepository.update(userEvent.id, {
        yookassaPaymentId: yookassaPayment.id,
      });
    } catch (dbErr) {
      this.logger.error(
        `Failed to store yookassaPaymentId for userEvent ${userEvent.id} — migration may not have run yet. Webhook will still update paymentStatus. Error: ${(dbErr as Error).message}`
      );
    }

    if (yookassaPayment.status === 'succeeded') {
      await this.userEventRepository.update(userEvent.id, {
        paymentStatus: UserEventPaymentStatus.PAID,
        status: ParticipationStatus.REGISTERED,
      });
      return { status: 'succeeded', message: 'Оплата прошла успешно', yookassaPaymentId: yookassaPayment.id };
    }

    return {
      status: yookassaPayment.status,
      confirmationUrl: yookassaPayment.confirmation_url,
      message: 'Требуется подтверждение оплаты',
      yookassaPaymentId: yookassaPayment.id,
    };
  }

  /**
   * Resolves the payment method for a user.
   * If the method is PENDING (YooKassa webhook never arrived after binding),
   * queries YooKassa to check if the binding actually succeeded and heals the record.
   */
  private async resolvePaymentMethod(userId: string, paymentMethodId?: string): Promise<PaymentMethod> {
    let paymentMethod: PaymentMethod | null;

    if (paymentMethodId) {
      paymentMethod = await this.paymentMethodRepository.findOne({
        where: { id: paymentMethodId, userId },
      });
    } else {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user?.defaultPaymentMethodId) {
        throw new BadRequestException('Не выбран способ оплаты');
      }
      paymentMethod = await this.paymentMethodRepository.findOne({
        where: { id: user.defaultPaymentMethodId, userId },
      });
    }

    if (!paymentMethod) throw new NotFoundException('Способ оплаты не найден');

    // Auto-heal: if PENDING, try to recover from YooKassa (webhook may not have arrived)
    if (paymentMethod.status === PaymentMethodStatus.PENDING) {
      this.logger.warn(
        `Payment method ${paymentMethod.id} is PENDING — attempting auto-heal from YooKassa`
      );
      await this.tryRecoverCardToken(paymentMethod);
    }

    if (paymentMethod.status !== PaymentMethodStatus.ACTIVE) {
      throw new BadRequestException(
        'Способ оплаты не активен. Удалите карту и привяжите заново.'
      );
    }

    return paymentMethod;
  }

  /**
   * Attempts to recover the correct cardToken (saved payment_method_id) from the original
   * 1-ruble binding payment stored in yookassaPaymentId. Updates the DB record on success.
   * Returns true if recovery succeeded.
   */
  private async tryRecoverCardToken(paymentMethod: PaymentMethod): Promise<boolean> {
    if (!paymentMethod.yookassaPaymentId) return false;

    try {
      const originalPayment = await this.yookassaService.getPayment(paymentMethod.yookassaPaymentId);
      const pmId = originalPayment.payment_method?.id;

      if (!pmId || pmId === paymentMethod.cardToken) return false;

      this.logger.log(
        `Recovering cardToken for pm ${paymentMethod.id}: ${paymentMethod.cardToken?.substring(0, 8)}... → ${pmId.substring(0, 8)}...`
      );

      const card = originalPayment.payment_method?.card;
      await this.paymentMethodRepository.update(paymentMethod.id, {
        cardToken: pmId,
        yookassaPaymentId: pmId,
        status: PaymentMethodStatus.ACTIVE,
        ...(card && {
          cardMasked: `${card.first6}******${card.last4}`,
          cardType: card.card_type,
          expiryMonth: card.expiry_month,
          expiryYear: card.expiry_year,
        }),
      });

      paymentMethod.cardToken = pmId;
      paymentMethod.status = PaymentMethodStatus.ACTIVE;

      // Set as default if this is the first active card
      const activeCount = await this.paymentMethodRepository.count({
        where: { userId: paymentMethod.userId, status: PaymentMethodStatus.ACTIVE },
      });
      if (activeCount === 1) {
        await this.userRepository.update(paymentMethod.userId, {
          defaultPaymentMethodId: paymentMethod.id,
        });
      }

      return true;
    } catch (err) {
      this.logger.warn(
        `cardToken recovery failed for pm ${paymentMethod.id}: ${(err as Error).message}`
      );
      return false;
    }
  }
}
