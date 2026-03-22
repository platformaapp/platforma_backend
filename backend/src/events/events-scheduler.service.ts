import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { MyOwnConferenceService } from './myownconference.service';

@Injectable()
export class EventsSchedulerService {
  private readonly logger = new Logger(EventsSchedulerService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    private readonly myOwnConferenceService: MyOwnConferenceService
  ) {}

  /**
   * Every 2 minutes: mark events whose datetime_end has passed as ENDED.
   * This is the primary mechanism since MyOwnConference has no webhooks.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async markEndedEvents(): Promise<void> {
    const now = new Date();

    const result = await this.eventsRepository
      .createQueryBuilder()
      .update(Event)
      .set({ status: EventStatus.ENDED })
      .where('status IN (:...statuses)', {
        statuses: [EventStatus.SCHEDULED, EventStatus.ACTIVE],
      })
      .andWhere('datetime_end <= :now', { now })
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
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
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
        const recordingUrl = await this.myOwnConferenceService.getRecordingUrl(
          event.videoRoom.externalId
        );

        if (recordingUrl) {
          await this.eventsRepository.update(event.id, { recordingUrl });
          this.logger.log(`Recording URL saved for event ${event.id}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch recording for event ${event.id}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}
