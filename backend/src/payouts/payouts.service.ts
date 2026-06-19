import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TutorPayout, PayoutMethod, PayoutStatus } from './entities/tutor-payout.entity';
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { PaymentStatus as UserEventPaymentStatus, UserEvent } from 'src/events/entities/user-event.entity';
import { User } from 'src/users/user.entity';
import { YookassaService } from 'src/payments/yookassa.service';

const MIN_PAYOUT_AMOUNT = 100;

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(TutorPayout)
    private readonly payoutRepository: Repository<TutorPayout>,

    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(UserEvent)
    private readonly userEventRepository: Repository<UserEvent>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly yookassaService: YookassaService,
  ) {}

  async getBalance(tutorId: string): Promise<{
    earned: number;
    pendingPayout: number;
    available: number;
    currency: string;
  }> {
    // Session earnings
    const sessionResult = await this.paymentRepository
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.tutorId = :tutorId', { tutorId })
      .andWhere('p.status = :status', { status: PaymentStatus.SUCCESS })
      .getRawOne<{ total: string }>();

    // Event earnings — use mentorRevenue if set, else event price
    const eventResult = await this.userEventRepository
      .createQueryBuilder('ue')
      .innerJoin('ue.event', 'e')
      .select(
        'COALESCE(SUM(CASE WHEN e.mentor_revenue > 0 THEN e.mentor_revenue ELSE e.price END), 0)',
        'total',
      )
      .where('e.mentorId = :tutorId', { tutorId })
      .andWhere('ue.paymentStatus = :status', { status: UserEventPaymentStatus.PAID })
      .getRawOne<{ total: string }>();

    // Already paid out or in flight
    const payoutResult = await this.payoutRepository
      .createQueryBuilder('po')
      .select('COALESCE(SUM(po.amount), 0)', 'total')
      .where('po.tutorId = :tutorId', { tutorId })
      .andWhere('po.status IN (:...statuses)', {
        statuses: [PayoutStatus.PENDING, PayoutStatus.SUCCEEDED],
      })
      .getRawOne<{ total: string }>();

    const earned = Number(sessionResult.total) + Number(eventResult.total);
    const pendingPayout = Number(payoutResult.total);
    const available = Math.max(0, earned - pendingPayout);

    return { earned, pendingPayout, available, currency: 'RUB' };
  }

  async savePayoutDetails(
    tutorId: string,
    method: PayoutMethod,
    destination: string,
    bankId?: string,
  ): Promise<void> {
    if (method === PayoutMethod.BANK_CARD) {
      if (!/^\d{16,19}$/.test(destination.replace(/\s/g, ''))) {
        throw new BadRequestException('Некорректный номер карты');
      }
    } else {
      if (!/^\+7\d{10}$/.test(destination.replace(/\s/g, ''))) {
        throw new BadRequestException('Некорректный номер телефона. Формат: +7XXXXXXXXXX');
      }
      if (!bankId) {
        throw new BadRequestException('Для СБП необходимо выбрать банк');
      }
    }

    await this.userRepository.update(tutorId, {
      payoutMethod: method,
      payoutDestination: destination.replace(/\s/g, ''),
      payoutBankId: method === PayoutMethod.SBP ? bankId : null,
    });
  }

  async getPayoutDetails(tutorId: string): Promise<{
    method: string | null;
    destinationMasked: string | null;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: tutorId },
      select: ['id', 'payoutMethod', 'payoutDestination'],
    });

    if (!user?.payoutDestination) {
      return { method: null, destinationMasked: null };
    }

    return {
      method: user.payoutMethod,
      destinationMasked: this.maskDestination(user.payoutMethod, user.payoutDestination),
    };
  }

  async requestPayout(tutorId: string, amount: number): Promise<TutorPayout> {
    if (isNaN(amount) || amount < MIN_PAYOUT_AMOUNT) {
      throw new BadRequestException(`Минимальная сумма вывода — ${MIN_PAYOUT_AMOUNT} ₽`);
    }

    const user = await this.userRepository.findOne({
      where: { id: tutorId },
      select: ['id', 'payoutMethod', 'payoutDestination', 'payoutBankId', 'fullName'],
    });

    if (!user?.payoutMethod || !user?.payoutDestination) {
      throw new BadRequestException('Добавьте реквизиты для вывода средств');
    }

    if (user.payoutMethod === PayoutMethod.SBP && !user.payoutBankId) {
      throw new BadRequestException('Для СБП необходимо выбрать банк. Обновите реквизиты.');
    }

    const { available } = await this.getBalance(tutorId);

    if (amount > available) {
      throw new BadRequestException(
        `Недостаточно средств. Доступно: ${available.toFixed(2)} ₽`,
      );
    }

    const payout = this.payoutRepository.create({
      tutorId,
      amount,
      currency: 'RUB',
      status: PayoutStatus.PENDING,
      method: user.payoutMethod as PayoutMethod,
      destinationMasked: this.maskDestination(user.payoutMethod, user.payoutDestination),
    });
    const saved = await this.payoutRepository.save(payout);

    // Send to YooKassa
    try {
      const result = await this.yookassaService.createPayout({
        amount,
        method: user.payoutMethod as 'bank_card' | 'sbp',
        destination: user.payoutDestination,
        bankId: user.payoutBankId ?? undefined,
        description: `Выплата наставнику ${user.fullName ?? tutorId}`,
        payoutId: saved.id,
      });

      const finalStatus =
        result.status === 'succeeded' ? PayoutStatus.SUCCEEDED : PayoutStatus.PENDING;

      await this.payoutRepository.update(saved.id, {
        yookassaPayoutId: result.id,
        status: finalStatus,
        processedAt: finalStatus === PayoutStatus.SUCCEEDED ? new Date() : null,
      });

      saved.yookassaPayoutId = result.id;
      saved.status = finalStatus;
    } catch (error) {
      const msg = (error as Error).message;
      this.logger.error(`Payout ${saved.id} failed: ${msg}`);
      await this.payoutRepository.update(saved.id, {
        status: PayoutStatus.FAILED,
        errorMessage: msg,
      });
      saved.status = PayoutStatus.FAILED;
      saved.errorMessage = msg;
    }

    return saved;
  }

  async getPayouts(tutorId: string): Promise<TutorPayout[]> {
    return this.payoutRepository.find({
      where: { tutorId },
      order: { createdAt: 'DESC' },
    });
  }

  private maskDestination(method: string | null, destination: string): string {
    if (method === 'bank_card') {
      return '**** **** **** ' + destination.slice(-4);
    }
    // sbp — phone
    return destination.slice(0, 2) + '***' + destination.slice(-4);
  }
}
