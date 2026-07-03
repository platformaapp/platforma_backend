import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { VideoProvider } from './entities/video-room.entity';
import { MyOwnConferenceService } from './myownconference.service';
import { UserEvent, ParticipationStatus, PaymentStatus } from './entities/user-event.entity';
import { YookassaService } from '../payments/yookassa.service';

@Injectable()
export class EventsSchedulerService {
  private readonly logger = new Logger(EventsSchedulerService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(UserEvent)
    private readonly userEventRepository: Repository<UserEvent>,
    private readonly myOwnConferenceService: MyOwnConferenceService,
    private readonly yookassaService: YookassaService,
  ) {}

  /**
   * Every 5 minutes: mark events whose datetime_end has passed as ENDED.
   * Uses a 2-minute grace buffer so events are not prematurely ended.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async markEndedEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000); // 2-minute grace period

    const result = await this.eventsRepository
      .createQueryBuilder()
      .update(Event)
      .set({ status: EventStatus.ENDED })
      .where('status IN (:...statuses)', {
        statuses: [EventStatus.SCHEDULED, EventStatus.ACTIVE],
      })
      .andWhere('datetime_end <= :cutoff', { cutoff })
      .execute();

    if (result.affected > 0) {
      this.logger.log(`Marked ${result.affected} event(s) as ENDED`);
    }
  }

  /**
   * Every minute: mark events whose datetime_start has passed (but not ended yet) as ACTIVE.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async markActiveEvents(): Promise<void> {
    const now = new Date();

    const result = await this.eventsRepository
      .createQueryBuilder()
      .update(Event)
      .set({ status: EventStatus.ACTIVE })
      .where('status = :status', { status: EventStatus.SCHEDULED })
      .andWhere('datetime_start <= :now', { now })
      .andWhere('datetime_end > :now', { now })
      .execute();

    if (result.affected > 0) {
      this.logger.log(`Marked ${result.affected} event(s) as ACTIVE`);
    }
  }

  /**
   * Every 10 minutes: fetch recording URLs for recently ended events that don't have one yet.
   * MyOwnConference makes recordings available some time after the session ends.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async fetchRecordingUrls(): Promise<void> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const events = await this.eventsRepository.find({
      where: {
        status: EventStatus.ENDED,
        recordingUrl: null,
      },
      relations: ['videoRoom'],
    });

    const recentEnded = events.filter(
      (e) =>
        e.videoRoom?.externalId &&
        e.datetimeEnd >= threeDaysAgo
    );

    if (recentEnded.length === 0) return;

    this.logger.log(`Checking recordings for ${recentEnded.length} recently ended event(s)`);

    for (const event of recentEnded) {
      try {
        let recordingUrl: string | null = null;

        if (event.videoRoom.provider === VideoProvider.MY_OWN_CONFERENCE) {
          recordingUrl = await this.myOwnConferenceService.getRecordingUrl(event.videoRoom.externalId);
        }

        if (recordingUrl) {
          await this.eventsRepository.update(event.id, { recordingUrl });
          this.logger.log(`Recording URL saved for event ${event.id}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch recording for event ${event.id}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  /**
   * Every hour: cancel stale pending event registrations.
   *
   * Finds UserEvents where paymentStatus=PENDING and createdAt > 2 hours ago.
   * If a YooKassa payment ID exists, checks the real payment status:
   *   - succeeded → missed webhook; mark as PAID so the user is not wrongly cancelled
   *   - anything else (pending/canceled/expired/failed) after 2 h → cancel
   * If no payment ID → cancel immediately (payment was never initiated).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cancelStalePendingRegistrations(): Promise<void> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const stale = await this.userEventRepository.find({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        status: In([ParticipationStatus.PENDING, ParticipationStatus.REGISTERED]),
      },
    });

    const staleOld = stale.filter((ue) => ue.createdAt <= twoHoursAgo);

    if (staleOld.length === 0) return;

    this.logger.log(`Found ${staleOld.length} stale pending registration(s) to evaluate`);

    let cancelled = 0;
    let recovered = 0;

    for (const userEvent of staleOld) {
      try {
        if (userEvent.yookassaPaymentId) {
          const ykPayment = await this.yookassaService.getPayment(userEvent.yookassaPaymentId);

          if (ykPayment.status === 'succeeded') {
            // Missed webhook — recover the registration instead of cancelling
            await this.userEventRepository.update(userEvent.id, {
              paymentStatus: PaymentStatus.PAID,
              status: ParticipationStatus.REGISTERED,
            });
            this.logger.warn(
              `Recovered missed payment for userEvent ${userEvent.id} (yk=${userEvent.yookassaPaymentId})`
            );
            recovered++;
            continue;
          }
        }

        // No payment ID or non-succeeded status → cancel
        await this.userEventRepository.update(userEvent.id, {
          status: ParticipationStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
        });
        cancelled++;
      } catch (error) {
        this.logger.error(
          `Failed to process stale registration ${userEvent.id}: ${(error as Error).message}`
        );
      }
    }

    if (cancelled > 0 || recovered > 0) {
      this.logger.log(
        `Stale registrations: ${cancelled} cancelled, ${recovered} recovered via missed webhook`
      );
    }
  }
}
