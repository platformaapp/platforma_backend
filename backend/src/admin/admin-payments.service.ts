import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from 'src/payments/entities/payment.entity';
import {
  UserEvent,
  PaymentStatus as UserEventPaymentStatus,
} from 'src/events/entities/user-event.entity';

/**
 * Строка экспорта платежей для админки — объединяет два независимых
 * источника оплат в системе (см. PaymentsService.getStudentPayments,
 * который делает то же самое для истории одного студента):
 *  - payments (оплата разовых сессий с наставником один-на-один);
 *  - user_events.yookassa_payment_id (оплата мероприятий/лекций — эти
 *    платежи никогда не попадают в таблицу payments, см. комментарий
 *    в PaymentsService.handlePaymentWebhook).
 *
 * Часть колонок отчёта ЮKassa (сумма к зачислению, RRN, статус
 * авторизации, точная сумма возврата) у нас нигде не хранится — их можно
 * получить только живым запросом к API ЮKassa по каждому platёжному ID,
 * что для выгрузки "за весь период" означает N последовательных
 * запросов и риск упереться в лимиты. Пока отдаём то, что есть в своей
 * БД, эти колонки останутся пустыми.
 */
export interface PaymentExportRow {
  orderCreatedAt: Date;
  paidAt: Date | null;
  paymentId: string;
  status: string;
  amount: number;
  /** Сумма к зачислению (после комиссии ЮKassa) — у нас не хранится, всегда ''. */
  incomeAmount: string;
  currency: string;
  description: string;
  paymentMethod: string;
  /** Сумма возврата — знаем факт и дату возврата, но не точную сумму. */
  refundAmount: string;
  refundedAt: Date | null;
  /** RRN операции — не хранится, только через живой запрос к API ЮKassa. */
  rrn: string;
  cardMasked: string;
  /** Статус авторизации — не хранится. */
  authStatus: string;
  /** Аналитические метки ЮKassa (статьи), рассрочка — не используем, всегда ''. */
  articleIdCode: string;
  articleIdName: string;
  accountNumber: string;
  creditTariff: string;
  creditDiscount: string;
  paymentSign: string;
  lectureId: string;
  lectureName: string;
  lectureDate: Date | null;
  speakerId: string;
  speakerName: string;
}

@Injectable()
export class AdminPaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(UserEvent)
    private readonly userEventsRepository: Repository<UserEvent>
  ) {}

  async exportPayments(from?: Date, to?: Date): Promise<PaymentExportRow[]> {
    const paymentsQb = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.tutor', 'tutor')
      .leftJoinAndSelect('payment.transaction', 'transaction')
      .leftJoinAndSelect('transaction.paymentMethod', 'paymentMethod')
      .orderBy('payment.createdAt', 'DESC');
    if (from) paymentsQb.andWhere('payment.createdAt >= :from', { from });
    if (to) paymentsQb.andWhere('payment.createdAt <= :to', { to });

    const userEventsQb = this.userEventsRepository
      .createQueryBuilder('userEvent')
      .leftJoinAndSelect('userEvent.event', 'event')
      .leftJoinAndSelect('event.mentor', 'mentor')
      .orderBy('userEvent.createdAt', 'DESC');
    if (from) userEventsQb.andWhere('userEvent.createdAt >= :from', { from });
    if (to) userEventsQb.andWhere('userEvent.createdAt <= :to', { to });

    const [payments, userEvents] = await Promise.all([
      paymentsQb.getMany(),
      userEventsQb.getMany(),
    ]);

    // Поля, которых нигде в нашей БД нет (см. комментарии на полях PaymentExportRow) —
    // одинаково пустые что для сессий, что для мероприятий.
    const unavailableFields = {
      incomeAmount: '',
      refundAmount: '',
      rrn: '',
      authStatus: '',
      articleIdCode: '',
      articleIdName: '',
      accountNumber: '',
      creditTariff: '',
      creditDiscount: '',
      paymentSign: '',
    };

    const sessionRows: { row: PaymentExportRow; sortAt: Date }[] = payments.map((p) => ({
      row: {
        orderCreatedAt: p.createdAt,
        paidAt: p.paidAt ?? null,
        paymentId: p.providerPaymentId || p.id,
        status: p.status,
        amount: Number(p.amount),
        currency: p.currency,
        description: p.tutor ? `Оплата сессии с наставником ${p.tutor.fullName}` : 'Оплата сессии',
        paymentMethod: p.transaction?.paymentMethod?.cardType || '',
        refundedAt: p.refundedAt ?? null,
        cardMasked: p.transaction?.paymentMethod?.cardMasked || '',
        lectureId: '',
        lectureName: '',
        lectureDate: null,
        speakerId: p.tutorId || '',
        speakerName: p.tutor?.fullName || '',
        ...unavailableFields,
      },
      sortAt: p.paidAt ?? p.createdAt,
    }));

    const eventRows: { row: PaymentExportRow; sortAt: Date }[] = userEvents
      // Только те, у кого была реальная попытка оплаты — регистрации без
      // платежа (бесплатные события, ожидание оплаты) в реестр не нужны.
      .filter((ue) => !!ue.yookassaPaymentId)
      .map((ue) => {
        const ev = ue.event;
        const isPaid = ue.paymentStatus === UserEventPaymentStatus.PAID;
        return {
          row: {
            orderCreatedAt: ue.createdAt,
            paidAt: isPaid ? ue.updatedAt : null,
            paymentId: ue.yookassaPaymentId,
            status: ue.paymentStatus,
            amount: ev ? Number(ev.price) : 0,
            currency: 'RUB',
            description: ev ? `Оплата мероприятия «${ev.title}»` : 'Оплата мероприятия',
            paymentMethod: '',
            refundedAt: ue.refundedAt ?? null,
            cardMasked: '',
            lectureId: ue.eventId || '',
            lectureName: ev?.title || '',
            lectureDate: ev?.datetimeStart ?? null,
            speakerId: ev?.mentorId || '',
            speakerName: ev?.mentor?.fullName || '',
            ...unavailableFields,
          },
          sortAt: ue.createdAt,
        };
      });

    return [...sessionRows, ...eventRows]
      .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
      .map((x) => x.row);
  }
}
