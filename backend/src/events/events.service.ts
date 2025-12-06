import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { VideoProvider, VideoRoom } from './entities/video-room.entity';
import { In, Repository } from 'typeorm';
import { Event, EventStatus, EventType } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ParticipationStatus, PaymentStatus, UserEvent } from './entities/user-event.entity';
import { PaymentStatus as PaymentEntityStatus } from '../payments/entities/payment.entity';

import {
  EventDetailResponseDto,
  MentorInfoDto,
  VideoRoomInfoDto,
} from './dto/event-detail-response.dto';
import { CountdownResponseDto } from './dto/countdown-response.dto';
import { EmailService } from '../notifications/email.service';
import { MyOwnConferenceService } from './myownconference.service';
import { CreateVideoRoomDto, VideoRoomResponseDto } from './dto/create-video-room.dto';
import { Payment } from 'src/payments/entities/payment.entity';
import { EventsFeedQueryDto } from './dto/events-feed-query.dto';
import {
  EventFeedItemDto,
  EventsFeedResponseDto,
  MentorDto,
  PaginationDto,
  TimeToEventDto,
} from './dto/events-feed-response.dto';
import { Session } from 'src/session/entities/session.entity';
import {
  MyEventItemDto,
  MyEventsPaginationDto,
  MyEventsResponseDto,
  TimeLeftDto,
  UserInfoDto,
} from './dto/my-events-response.dto';
import { MyEventsFilter, MyEventsQueryDto } from './dto/my-events-query.dto';
import { EventWithParticipantsDto, ParticipantDto } from './dto/event-with-participants.dto';
import { CancelRegistrationResponseDto } from './dto/cancel-registration-response.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(VideoRoom)
    private readonly videoRoomRepository: Repository<VideoRoom>,
    @InjectRepository(UserEvent)
    private readonly userEventRepository: Repository<UserEvent>,
    private readonly emailService: EmailService,
    private readonly myOwnConferenceService: MyOwnConferenceService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>
  ) {}

  async createEvent(createEventDto: CreateEventDto, mentorId: string): Promise<Event> {
    if (createEventDto.sessionId) {
      const existingEvent = await this.eventsRepository.findOne({
        where: { sessionId: createEventDto.sessionId },
      });

      if (existingEvent) {
        throw new ConflictException('Для этой сессии уже создано событие');
      }
    }

    let startDate = createEventDto.datetime_start ? new Date(createEventDto.datetime_start) : null;
    let endDate = createEventDto.datetime_end ? new Date(createEventDto.datetime_end) : null;
    const now = new Date();

    const mentor = await this.usersRepository.findOne({
      where: { id: mentorId, role: 'tutor' },
    });

    if (!mentor) {
      throw new ForbiddenException('Только наставники могут создавать события');
    }

    let session: Session | null = null;
    if (createEventDto.sessionId) {
      session = await this.sessionRepository.findOne({
        where: {
          id: createEventDto.sessionId,
          tutorId: mentorId,
        },
        relations: ['student', 'payment'],
      });

      if (!session) {
        throw new NotFoundException('Сессия не найдена или у вас нет к ней доступа');
      }

      if (session.price > 0 && !session.paymentId) {
        throw new BadRequestException('Сессия не оплачена, нельзя создать событие');
      }

      if (!startDate) {
        startDate = session.startTime;
      }
      if (!endDate) {
        endDate = session.endTime;
      }
      if (!createEventDto.price) {
        createEventDto.price = Number(session.price);
      }
    }

    if (!startDate || !endDate) {
      throw new BadRequestException('Не указано время начала и окончания события');
    }

    if (startDate >= endDate) {
      throw new BadRequestException('Время окончания должно быть позже времени начала');
    }

    if (startDate <= now) {
      throw new BadRequestException('Время начала должно быть в будущем');
    }

    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

    const platformFee = Number((createEventDto.price * 0.1).toFixed(2));
    const mentorRevenue = Number((createEventDto.price * 0.9).toFixed(2));

    const event = this.eventsRepository.create({
      title: createEventDto.title,
      description: createEventDto.description || '',
      datetimeStart: startDate,
      datetimeEnd: endDate,
      durationMinutes,
      price: createEventDto.price,
      platformFee,
      mentorRevenue,
      maxParticipants: createEventDto.max_participants || 30,
      mentorId,
      status: EventStatus.SCHEDULED,
      session: session ? { id: session.id } : undefined,
      sessionId: session?.id,
      type: session ? EventType.SESSION_BASED : EventType.STANDALONE,
    });

    const savedEvent = await this.eventsRepository.save(event);

    try {
      let webinarName = savedEvent.title;
      if (session) {
        const studentName = session.student.fullName || session.student.email.split('@')[0];
        webinarName = `${savedEvent.title} - ${studentName}`;
      }

      const webinarResponse = await this.myOwnConferenceService.createWebinar({
        name: webinarName,
        start: this.myOwnConferenceService.formatDateForAPI(savedEvent.datetimeStart),
        duration: savedEvent.durationMinutes,
      });

      const videoRoom = this.videoRoomRepository.create({
        event: savedEvent,
        provider: VideoProvider.MY_OWN_CONFERENCE,
        url: webinarResponse.webinarLink,
        externalId: webinarResponse.alias,
        moderatorUrl: webinarResponse.mainModeratorLink,
      });

      await this.videoRoomRepository.save(videoRoom);

      savedEvent.videoRoom = videoRoom;
      savedEvent.videoRoomId = videoRoom.id;
    } catch (error) {
      this.logger.error('Failed to create webinar room', error);
    }

    if (session) {
      await this.autoRegisterStudentForSessionEvent(savedEvent, session);
    }

    try {
      await this.sendEventCreatedNotification(savedEvent);
    } catch (error) {
      console.error('Event created but notification failed:', error);
    }
    return savedEvent;
  }

  async updateEvent(
    eventId: string,
    updateEventDto: UpdateEventDto,
    mentorId: string
  ): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['userEvents'],
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    const originalDateTimeStart = new Date(event.datetimeStart);
    const originalDateTimeEnd = new Date(event.datetimeEnd);

    if (event.mentorId !== mentorId) {
      throw new ForbiddenException('Вы можете редактировать только свои события');
    }

    const now = new Date();
    if (event.datetimeStart <= now) {
      if (updateEventDto.title !== undefined) {
        throw new BadRequestException('Нельзя изменять название после начала события');
      }
      if (updateEventDto.datetime_start !== undefined) {
        throw new BadRequestException('Нельзя изменять время после начала события');
      }
      if (updateEventDto.price !== undefined) {
        throw new BadRequestException('Нельзя изменять цену после начала события');
      }
    }

    if (updateEventDto.max_participants !== undefined) {
      const currentParticipants = event.userEvents?.length || 0;
      if (updateEventDto.max_participants < currentParticipants) {
        throw new BadRequestException(
          `Новый лимит участников (${updateEventDto.max_participants}) меньше текущего количества записанных (${currentParticipants})`
        );
      }
    }

    const isDateTimeStartChanged =
      updateEventDto.datetime_start !== undefined &&
      new Date(updateEventDto.datetime_start).getTime() !== originalDateTimeStart.getTime();

    const isDateTimeEndChanged =
      updateEventDto.datetime_end !== undefined &&
      new Date(updateEventDto.datetime_end).getTime() !== originalDateTimeEnd.getTime();

    const isDateTimeChanged = isDateTimeStartChanged || isDateTimeEndChanged;

    const isPriceChanged =
      updateEventDto.price !== undefined && updateEventDto.price !== event.price;

    if (updateEventDto.title !== undefined) {
      event.title = updateEventDto.title;
    }

    if (updateEventDto.description !== undefined) {
      event.description = updateEventDto.description;
    }

    if (updateEventDto.datetime_start !== undefined) {
      event.datetimeStart = new Date(updateEventDto.datetime_start);
    }

    if (updateEventDto.datetime_end !== undefined) {
      event.datetimeEnd = new Date(updateEventDto.datetime_end);
    }

    if (updateEventDto.datetime_start || updateEventDto.datetime_end) {
      event.durationMinutes = Math.round(
        (event.datetimeEnd.getTime() - event.datetimeStart.getTime()) / (1000 * 60)
      );
    }

    if (isPriceChanged) {
      const paidRegistrations = await this.userEventRepository.count({
        where: {
          eventId,
          paymentStatus: PaymentStatus.PAID,
        },
      });

      if (paidRegistrations > 0) {
        throw new BadRequestException(
          'Нельзя изменять цену, так как уже есть оплаченные регистрации'
        );
      }

      event.price = updateEventDto.price;
      event.platformFee = Number((updateEventDto.price * 0.1).toFixed(2));
      event.mentorRevenue = Number((updateEventDto.price * 0.9).toFixed(2));
    }

    if (updateEventDto.max_participants !== undefined) {
      event.maxParticipants = updateEventDto.max_participants;
    }

    event.updatedAt = new Date();

    const updatedEvent = await this.eventsRepository.save(event);

    if (isDateTimeChanged && event.userEvents && event.userEvents.length > 0) {
      await this.notifyParticipantsAboutTimeChange(updatedEvent, originalDateTimeStart);
    }

    if (updatedEvent.videoRoom?.externalId) {
      try {
        await this.myOwnConferenceService.updateWebinar(updatedEvent.videoRoom.externalId, {
          name: updatedEvent.title,
          start: this.myOwnConferenceService.formatDateForAPI(updatedEvent.datetimeStart),
          duration: updatedEvent.durationMinutes,
        });
      } catch (error) {
        this.logger.error('Failed to update webinar room', error);
      }
    }

    return updatedEvent;
  }

  async registerForEvent(eventId: string, studentId: string): Promise<UserEvent> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['userEvents'],
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    const now = new Date();
    if (event.datetimeStart <= now) {
      throw new BadRequestException('Нельзя записаться на событие после его начала');
    }

    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Событие отменено');
    }

    const student = await this.usersRepository.findOne({
      where: { id: studentId, role: 'student' },
    });

    if (!student) {
      throw new ForbiddenException('Только студенты могут записываться на события');
    }

    if (event.mentorId === studentId) {
      throw new BadRequestException('Наставник не может записаться на свое событие');
    }

    const existingRegistration = await this.userEventRepository.findOne({
      where: {
        eventId,
        userId: studentId,
      },
    });

    if (existingRegistration) {
      if (existingRegistration.status === ParticipationStatus.CANCELLED) {
        existingRegistration.status = ParticipationStatus.REGISTERED;
        existingRegistration.paymentStatus = PaymentStatus.PENDING;
        return await this.userEventRepository.save(existingRegistration);
      } else {
        throw new ConflictException('Вы уже записаны на это событие');
      }
    }

    const currentParticipants = await this.getRegisteredParticipantsCount(eventId);
    if (currentParticipants >= event.maxParticipants) {
      throw new BadRequestException('Достигнут лимит участников');
    }

    let paymentStatus = PaymentStatus.PENDING;
    let participationStatus = ParticipationStatus.PENDING;

    if (event.price > 0) {
      const successfulPayments = await this.paymentRepository.find({
        where: {
          userId: studentId,
          status: PaymentEntityStatus.SUCCESS,
        },
      });

      this.logger.log(
        `Found ${successfulPayments.length} successful payments for user during registration`
      );

      if (successfulPayments.length > 0) {
        paymentStatus = PaymentStatus.PAID;
        participationStatus = ParticipationStatus.REGISTERED;
        this.logger.log(`User has successful payments, setting registration as PAID`);
      } else {
        this.logger.log(`No successful payments found, registration will be PENDING`);
      }
    } else {
      paymentStatus = PaymentStatus.PAID;
      participationStatus = ParticipationStatus.REGISTERED;
    }

    const userEvent = this.userEventRepository.create({
      eventId,
      userId: studentId,
      status: participationStatus,
      paymentStatus: paymentStatus,
    });

    const savedUserEvent = await this.userEventRepository.save(userEvent);

    if (event.videoRoom?.externalId) {
      try {
        await this.myOwnConferenceService.addAttendeeToWebinar(
          event.videoRoom.externalId,
          student.email,
          student.fullName || student.email.split('@')[0]
        );
      } catch (error) {
        this.logger.error('Failed to add attendee to webinar', error);
      }
    }

    await this.notifyMentorAboutNewRegistration(event, student);

    return savedUserEvent;
  }

  async getRegisteredParticipantsCount(eventId: string): Promise<number> {
    return await this.userEventRepository.count({
      where: {
        eventId,
        status: ParticipationStatus.REGISTERED,
      },
    });
  }

  async deleteEvent(eventId: string, mentorId: string): Promise<void> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['userEvents', 'userEvents.user', 'videoRoom'],
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    if (event.mentorId !== mentorId) {
      throw new ForbiddenException('Вы можете удалять только свои события');
    }

    const now = new Date();
    if (event.datetimeStart <= now && event.status !== EventStatus.CANCELLED) {
      throw new BadRequestException('Нельзя удалить событие после его начала');
    }

    const participants =
      event.userEvents?.filter((ue) => ue.status === ParticipationStatus.REGISTERED) || [];

    if (event.videoRoom) {
      await this.deleteVideoRoom(event.videoRoom.id);
    }

    if (event.userEvents && event.userEvents.length > 0) {
      await this.userEventRepository.remove(event.userEvents);
    }

    await this.eventsRepository.remove(event);

    if (participants.length > 0) {
      this.notifyParticipantsAboutCancellation(event, participants).catch((error) =>
        console.error('Error in cancellation notifications:', error)
      );
    }
  }

  async getEventDetails(eventId: string): Promise<EventDetailResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['mentor', 'videoRoom', 'userEvents', 'userEvents.user'],
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    const registeredCount = await this.getRegisteredParticipantsCount(eventId);

    const countdown = this.calculateCountdown(event.datetimeStart);

    const durationMinutes = this.calculateDurationMinutes(event.datetimeStart, event.datetimeEnd);

    const mentorInfo: MentorInfoDto = {
      id: event.mentor.id,
      name: event.mentor.fullName || event.mentor.email.split('@')[0],
    };

    const videoRoomInfo: VideoRoomInfoDto = {
      url: event.videoRoom?.url || null,
    };

    return {
      id: event.id,
      title: event.title,
      mentor: mentorInfo,
      countdown,
      max_participants: event.maxParticipants,
      registered_count: registeredCount,
      video_room: videoRoomInfo,
      status: event.status,
      description: event.description,
      price: event.price,
      platform_fee: event.platformFee,
      mentor_revenue: event.mentorRevenue,
      duration_minutes: durationMinutes,
      datetime_start: event.datetimeStart?.toISOString() || null,
      datetime_end: event.datetimeEnd?.toISOString() || null,
    };
  }

  async getEventCountdown(eventId: string): Promise<CountdownResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    const now = new Date();
    let status: 'upcoming' | 'active' | 'ended' | 'cancelled' = 'upcoming';

    if (event.status === EventStatus.CANCELLED) {
      status = 'cancelled';
    } else if (event.status === EventStatus.ENDED) {
      status = 'ended';
    } else if (event.datetimeStart <= now && event.datetimeEnd > now) {
      status = 'active';
    } else if (event.datetimeEnd <= now) {
      status = 'ended';
    }

    const countdownInfo = this.calculateDetailedCountdown(event.datetimeStart, status);

    return {
      countdown: countdownInfo.countdown,
      seconds_remaining: countdownInfo.secondsRemaining,
      status,
    };
  }

  private async sendEventCreatedNotification(event: Event): Promise<void> {
    try {
      const mentor = await this.usersRepository.findOne({
        where: { id: event.mentorId },
      });

      if (mentor && mentor.email) {
        await this.emailService.sendEventCreatedEmail(
          mentor.email,
          mentor.fullName || mentor.email.split('@')[0],
          event.title,
          event.datetimeStart.toISOString(),
          event.price,
          event.maxParticipants
        );
      }
    } catch (error) {
      console.error('Failed to send event created notification:', error);
    }
  }

  private calculateDurationMinutes(start?: Date | null, end?: Date | null): number | null {
    if (!start || !end) {
      return null;
    }

    const durationMs = end.getTime() - start.getTime();
    return Math.floor(durationMs / 60000);
  }

  private calculateCountdown(eventStart: Date): string {
    const now = new Date();
    const timeDiff = eventStart.getTime() - now.getTime();

    if (timeDiff <= 0) {
      return 'Событие началось';
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days} ${this.getRussianWord(days, ['день', 'дня', 'дней'])}`);
    }

    if (hours > 0) {
      parts.push(`${hours} ${this.getRussianWord(hours, ['час', 'часа', 'часов'])}`);
    }

    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes} ${this.getRussianWord(minutes, ['минута', 'минуты', 'минут'])}`);
    }

    return parts.join(' ');
  }

  private formatCountdown(days: number, hours: number, minutes: number, seconds: number): string {
    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days} ${this.getRussianWord(days, ['день', 'дня', 'дней'])}`);
    }

    if (hours > 0) {
      parts.push(`${hours} ${this.getRussianWord(hours, ['час', 'часа', 'часов'])}`);
    }

    if (minutes > 0) {
      parts.push(`${minutes} ${this.getRussianWord(minutes, ['минута', 'минуты', 'минут'])}`);
    }

    if (days === 0 && hours === 0 && minutes < 60) {
      parts.push(`${seconds} ${this.getRussianWord(seconds, ['секунда', 'секунды', 'секунд'])}`);
    }

    if (days === 0 && hours === 0 && minutes === 0) {
      return `Меньше минуты`;
    }

    return parts.join(' ') || 'Событие скоро начнется';
  }

  private calculateDetailedCountdown(
    eventStart: Date,
    status: string
  ): { countdown: string; secondsRemaining?: number } {
    const now = new Date();

    if (status === 'cancelled') {
      return { countdown: 'Событие отменено' };
    }

    if (status === 'ended') {
      return { countdown: 'Событие завершено' };
    }

    if (status === 'active') {
      return { countdown: 'Событие идет сейчас' };
    }

    const timeDiff = eventStart.getTime() - now.getTime();

    if (timeDiff <= 0) {
      return { countdown: 'Событие началось' };
    }

    const secondsRemaining = Math.floor(timeDiff / 1000);
    const days = Math.floor(secondsRemaining / (3600 * 24));
    const hours = Math.floor((secondsRemaining % (3600 * 24)) / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    const seconds = secondsRemaining % 60;

    const countdown = this.formatCountdown(days, hours, minutes, seconds);

    return {
      countdown,
      secondsRemaining,
    };
  }

  private getRussianWord(count: number, words: [string, string, string]): string {
    const cases = [2, 0, 1, 1, 1, 2];
    return words[count % 100 > 4 && count % 100 < 20 ? 2 : cases[Math.min(count % 10, 5)]];
  }

  private async deleteVideoRoom(videoRoomId: string): Promise<void> {
    try {
      const videoRoom = await this.videoRoomRepository.findOne({
        where: { id: videoRoomId },
      });

      if (videoRoom && videoRoom.externalId) {
        await this.myOwnConferenceService.deleteWebinar(videoRoom.externalId);
        await this.videoRoomRepository.remove(videoRoom);
      }
    } catch (error) {
      console.error('Ошибка при удалении видеокомнаты:', error);
    }
  }

  private async notifyParticipantsAboutTimeChange(event: Event, oldDateTime: Date): Promise<void> {
    try {
      const userEvents = await this.userEventRepository.find({
        where: {
          eventId: event.id,
          status: ParticipationStatus.REGISTERED,
        },
        relations: ['user'],
      });

      if (!userEvents || userEvents.length === 0) {
        console.log('No participants to notify about time change');
        return;
      }

      const mentor = await this.usersRepository.findOne({
        where: { id: event.mentorId },
      });

      const mentorName = mentor?.fullName || mentor?.email.split('@')[0] || 'Наставник';

      const emailPromises = userEvents.map(async (userEvent) => {
        const student = userEvent.user;
        if (student && student.email) {
          await this.emailService.sendEventTimeChangedEmail(
            student.email,
            student.fullName || student.email.split('@')[0],
            event.title,
            oldDateTime.toISOString(),
            event.datetimeStart.toISOString(),
            mentorName
          );
        }
      });

      await Promise.allSettled(emailPromises);

      console.log(`Time change notifications sent to ${userEvents.length} participants`);
    } catch (error) {
      console.error('Failed to send time change notifications:', error);
    }
  }

  private async notifyMentorAboutNewRegistration(event: Event, student: User): Promise<void> {
    try {
      const mentor = await this.usersRepository.findOne({
        where: { id: event.mentorId },
      });

      if (!mentor || !mentor.email) {
        console.log('Mentor not found or has no email');
        return;
      }

      const registeredCount = await this.getRegisteredParticipantsCount(event.id);

      await this.emailService.sendNewRegistrationEmail(
        mentor.email,
        mentor.fullName || mentor.email.split('@')[0],
        event.title,
        student.fullName || student.email.split('@')[0],
        student.email,
        event.datetimeStart.toISOString(),
        registeredCount,
        event.maxParticipants,
        event.price
      );

      console.log(`New registration notification sent to mentor for event: ${event.title}`);
    } catch (error) {
      console.error('Failed to send new registration notification:', error);
    }
  }

  private async notifyParticipantsAboutCancellation(
    event: Event,
    participants: UserEvent[]
  ): Promise<void> {
    try {
      const mentor = await this.usersRepository.findOne({
        where: { id: event.mentorId },
      });

      const mentorName = mentor?.fullName || mentor?.email.split('@')[0] || 'Наставник';

      const emailPromises = participants.map(async (userEvent) => {
        const student = userEvent.user;
        if (student && student.email) {
          let refundInfo = '';
          if (event.price > 0) {
            if (userEvent.paymentStatus === PaymentStatus.PAID) {
              refundInfo = 'Средства за оплаченное участие будут возвращены автоматически.';
            } else if (userEvent.paymentStatus === PaymentStatus.PENDING) {
              refundInfo = 'Ожидающая оплата была отменена, плата с вас не будет взиматься.';
            }
          }

          await this.emailService.sendEventCancelledEmail(
            student.email,
            student.fullName || student.email.split('@')[0],
            event.title,
            mentorName,
            event.datetimeStart.toISOString(),
            event.price,
            refundInfo
          );
        }
      });

      await Promise.allSettled(emailPromises);

      console.log(`Cancellation notifications sent to ${participants.length} participants`);
    } catch (error) {
      console.error('Failed to send cancellation notifications:', error);
    }
  }

  async getEventJoinUrl(eventId: string, userId: string): Promise<{ join_url: string }> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: [
        'videoRoom',
        'userEvents',
        'mentor',
        'userEvents.user',
        'session',
        'session.payment',
      ],
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    const userRegistration = await this.userEventRepository.findOne({
      where: {
        eventId,
        userId,
        status: In([ParticipationStatus.REGISTERED, ParticipationStatus.PENDING]),
      },
    });

    const isMentor = event.mentorId === userId;

    this.logger.log(`=== DEBUG ACCESS CHECK ===`);
    this.logger.log(
      `User: ${userId}, Event: ${eventId}, Price: ${event.price}, isMentor: ${isMentor}`
    );

    if (userRegistration) {
      this.logger.log(
        `User registration found: ${userRegistration.id}, PaymentStatus: ${userRegistration.paymentStatus}`
      );
    } else {
      this.logger.log(`No user registration found`);
    }

    if (event.price > 0 && !isMentor) {
      if (event.type === EventType.SESSION_BASED && event.session) {
        if (!event.session.paymentId) {
          throw new ForbiddenException('Сессия не оплачена');
        }

        const payment = await this.paymentRepository.findOne({
          where: { id: event.session.paymentId },
        });

        if (!payment || payment.status !== PaymentEntityStatus.SUCCESS) {
          throw new ForbiddenException('Сессия не оплачена');
        }
      } else {
        const successfulPayments = await this.paymentRepository.find({
          where: {
            userId: userId,
            status: PaymentEntityStatus.SUCCESS,
          },
        });

        if (!successfulPayments.length) {
          throw new ForbiddenException('Необходимо оплатить событие для доступа к видеочату');
        }
      }
    }

    if (!userRegistration && !isMentor) {
      throw new ForbiddenException('Вы не записаны на это событие');
    }

    const now = new Date();
    const timeUntilStart = event.datetimeStart.getTime() - now.getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    const isEventActive = event.datetimeStart <= now && event.datetimeEnd > now;
    const isWithinFifteenMinutes = timeUntilStart <= fifteenMinutes && timeUntilStart > 0;

    if (!isEventActive && !isWithinFifteenMinutes) {
      throw new ForbiddenException(
        'Подключиться к событию можно за 15 минут до начала или во время его проведения'
      );
    }

    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Событие было отменено');
    }

    if (!event.videoRoom) {
      throw new NotFoundException('Видеокомната для события не найдена');
    }

    try {
      if (isMentor && event.videoRoom?.moderatorUrl) {
        return { join_url: event.videoRoom.moderatorUrl };
      }

      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('Пользователь не найден');

      const attendeeLink = await this.myOwnConferenceService.getAttendeeLink(
        event.videoRoom.externalId,
        user.email
      );

      return { join_url: attendeeLink || event.videoRoom.url };
    } catch (error) {
      this.logger.error('Failed to get attendee link, using general URL', error);
      return {
        join_url: event.videoRoom.url,
      };
    }
  }

  async createVideoRoom(
    createVideoRoomDto: CreateVideoRoomDto,
    userId: string
  ): Promise<VideoRoomResponseDto> {
    const { event_id, provider } = createVideoRoomDto;

    const event = await this.eventsRepository.findOne({
      where: { id: event_id },
      relations: ['mentor'],
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    if (event.mentorId !== userId) {
      throw new ForbiddenException('Вы можете создавать видеокомнаты только для своих событий');
    }

    const existingVideoRoom = await this.videoRoomRepository.findOne({
      where: { eventId: event_id },
    });

    if (existingVideoRoom) {
      throw new ConflictException('Видеокомната для этого события уже существует');
    }

    try {
      let videoRoomData: {
        externalId: string;
        url: string;
        moderatorUrl: string;
      };

      switch (provider) {
        case VideoProvider.MY_OWN_CONFERENCE: {
          const webinarResponse = await this.myOwnConferenceService.createWebinar({
            name: event.title,
            start: this.myOwnConferenceService.formatDateForAPI(event.datetimeStart),
            duration: event.durationMinutes,
          });

          videoRoomData = {
            externalId: webinarResponse.alias,
            url: webinarResponse.webinarLink,
            moderatorUrl: webinarResponse.mainModeratorLink,
          };
          break;
        }

        case VideoProvider.TELEMOST:
          throw new BadRequestException('Интеграция с Telemost пока не реализована');

        case VideoProvider.JITSI:
          throw new BadRequestException('Интеграция с Jitsi пока не реализована');

        default:
          throw new BadRequestException(`Провайдер ${provider} не поддерживается`);
      }

      const videoRoom = this.videoRoomRepository.create({
        eventId: event_id,
        provider,
        url: videoRoomData.url,
        externalId: videoRoomData.externalId,
        moderatorUrl: videoRoomData.moderatorUrl,
        expiresAt: new Date(event.datetimeEnd.getTime() + 24 * 60 * 60 * 1000),
      });

      const savedVideoRoom = await this.videoRoomRepository.save(videoRoom);

      return {
        url: savedVideoRoom.url,
        provider: savedVideoRoom.provider,
        expires_at: savedVideoRoom.expiresAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create video room with provider ${provider}`, error);
      throw new BadRequestException(
        `Не удалось создать видеокомнату: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      );
    }
  }

  async getEventsFeed(query: EventsFeedQueryDto, userId?: string): Promise<EventsFeedResponseDto> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    if (page < 1) {
      throw new BadRequestException('invalid_page');
    }

    if (limit < 1 || limit > 100) {
      throw new BadRequestException('invalid_limit');
    }

    const now = new Date();

    const [events, total] = await this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.mentor', 'mentor')
      .leftJoinAndSelect('event.userEvents', 'userEvents')
      .where('event.status = :status', { status: EventStatus.SCHEDULED })
      .andWhere('event.datetimeStart > :now', { now })
      .orderBy('event.datetimeStart', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    let userEventsMap = new Map<string, { isRegistered: boolean; isPaid: boolean }>();

    if (userId) {
      const userEvents = await this.userEventRepository
        .createQueryBuilder('userEvent')
        .leftJoinAndSelect('userEvent.event', 'event')
        .where('userEvent.userId = :userId', { userId })
        .andWhere('userEvent.eventId IN (:...eventIds)', {
          eventIds: events.map((e) => e.id),
        })
        .getMany();

      userEventsMap = userEvents.reduce((map, userEvent) => {
        map.set(userEvent.event.id, {
          isRegistered: this.isUserRegistered(userEvent),
          isPaid: this.isUserPaid(userEvent),
        });
        return map;
      }, new Map<string, { isRegistered: boolean; isPaid: boolean }>());
    }

    const items: EventFeedItemDto[] = events.map((event) => {
      const timeToEvent = this.calculateTimeToEvent(event.datetimeStart);

      const mentor: MentorDto = {
        id: event.mentor.id,
        name: event.mentor.fullName,
        avatarUrl: event.mentor.avatarUrl,
      };

      const baseItem: EventFeedItemDto = {
        id: event.id,
        title: event.title,
        description: event.description,
        datetimeStart: event.datetimeStart.toISOString(),
        timeToEvent,
        durationMinutes: event.durationMinutes,
        coverUrl: event.coverUrl,
        price: Number(event.price),
        mentor,
        status: event.status,
      };

      if (userId) {
        const userEventInfo = userEventsMap.get(event.id);
        return {
          ...baseItem,
          isRegistered: userEventInfo?.isRegistered || false,
          isPaid: userEventInfo?.isPaid || false,
        };
      }

      return baseItem;
    });

    const pagination: PaginationDto = {
      page,
      limit,
      total,
      hasNext: page * limit < total,
    };

    return {
      items,
      pagination,
    };
  }

  async getMyEvents(query: MyEventsQueryDto, userId: string): Promise<MyEventsResponseDto> {
    const { role, filter, page, per_page } = query;

    if (page < 1) {
      throw new BadRequestException('Некорректный номер страницы');
    }

    if (per_page < 1 || per_page > 100) {
      throw new BadRequestException('Некорректное количество элементов на странице');
    }

    const skip = (page - 1) * per_page;

    const currentUser = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!currentUser) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (currentUser.role !== role) {
      throw new BadRequestException('Указанная роль не соответствует роли пользователя');
    }

    let queryBuilder = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.mentor', 'mentor')
      .leftJoinAndSelect('event.userEvents', 'userEvents')
      .leftJoinAndSelect('event.session', 'session')
      .leftJoinAndSelect('session.student', 'student')
      .orderBy('event.datetimeStart', 'ASC');

    queryBuilder = queryBuilder.andWhere('event.datetimeStart IS NOT NULL');

    if (role === 'tutor') {
      queryBuilder = queryBuilder.where('event.mentorId = :userId', { userId });
    } else if (role === 'student') {
      queryBuilder = queryBuilder
        .innerJoin('event.userEvents', 'myUserEvents')
        .where('myUserEvents.userId = :userId', { userId })
        .andWhere('myUserEvents.status IN (:...statuses)', {
          statuses: [ParticipationStatus.REGISTERED, ParticipationStatus.ATTENDED],
        });
    } else {
      throw new BadRequestException('Некорректная роль');
    }

    if (filter === MyEventsFilter.EVENTS) {
      queryBuilder = queryBuilder.andWhere('event.type = :type', {
        type: EventType.STANDALONE,
      });
    } else if (filter === MyEventsFilter.PERSONAL) {
      queryBuilder = queryBuilder.andWhere('event.type = :type', {
        type: EventType.SESSION_BASED,
      });
    }

    const [events, total] = await queryBuilder.skip(skip).take(per_page).getManyAndCount();

    const data: MyEventItemDto[] = events
      .filter((event): event is Event & { datetimeStart: Date } => !!event.datetimeStart)
      .map((event) => {
        if (!event.mentor) {
          throw new BadRequestException(`Событие ${event.id} не имеет наставника`);
        }

        const teacher: UserInfoDto = {
          id: event.mentor.id,
          name: event.mentor.fullName || event.mentor.email.split('@')[0],
          avatar: event.mentor.avatarUrl,
        };

        let student: UserInfoDto | undefined;
        if (event.type === EventType.SESSION_BASED && event.session?.student) {
          student = {
            id: event.session.student.id,
            name: event.session.student.fullName || event.session.student.email.split('@')[0],
            avatar: event.session.student.avatarUrl,
          };
        }

        const time_left = this.calculateTimeLeft(event.datetimeStart);

        return {
          id: event.id,
          title: event.title,
          type: event.type,
          teacher,
          ...(student && { student }),
          start_at: event.datetimeStart.toISOString(),
          price: Number(event.price),
          time_left,
          status: event.status,
        };
      });

    const pagination: MyEventsPaginationDto = {
      page,
      per_page,
      total,
    };

    return {
      data,
      pagination,
    };
  }

  async getEventWithParticipants(
    eventId: string,
    userId?: string
  ): Promise<EventWithParticipantsDto> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: [
        'mentor',
        'session',
        'session.student',
        'videoRoom',
        'userEvents',
        'userEvents.user',
      ],
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    const participantsData = await this.getEventParticipants(eventId);

    let currentUserParticipation: {
      is_registered: boolean;
      is_paid: boolean;
      status: string;
      payment_status: string;
    } | null = null;

    if (userId) {
      const userEvent = await this.userEventRepository.findOne({
        where: { eventId, userId },
      });

      if (userEvent) {
        currentUserParticipation = {
          is_registered: true,
          is_paid: userEvent.paymentStatus === PaymentStatus.PAID,
          status: userEvent.status,
          payment_status: userEvent.paymentStatus,
        };
      }
    }

    const canJoin = this.checkIfUserCanJoin(event, userId);

    const timeToEvent = event.datetimeStart
      ? this.calculateTimeToEventWithText(event.datetimeStart)
      : null;

    const registeredCount = await this.getRegisteredParticipantsCount(eventId);

    return {
      id: event.id,
      title: event.title,
      description: event.description || '',
      type: event.type,
      mentor: {
        id: event.mentor.id,
        name: event.mentor.fullName || event.mentor.email.split('@')[0],
        avatar: event.mentor.avatarUrl,
        bio: event.mentor.bio,
      },
      ...(event.type === EventType.SESSION_BASED &&
        event.session && {
          session: {
            id: event.session.id,
            student: {
              id: event.session.student.id,
              name: event.session.student.fullName || event.session.student.email.split('@')[0],
              avatar: event.session.student.avatarUrl,
            },
            status: event.session.status,
          },
        }),
      datetime_start: event.datetimeStart ? event.datetimeStart.toISOString() : null,
      datetime_end: event.datetimeEnd ? event.datetimeEnd.toISOString() : null,
      duration_minutes: event.durationMinutes,
      price: Number(event.price),
      platform_fee: Number(event.platformFee),
      mentor_revenue: Number(event.mentorRevenue),
      max_participants: event.maxParticipants,
      registered_count: registeredCount,
      status: event.status,
      cover_url: event.coverUrl,
      recording_url: event.recordingUrl,
      ...(event.videoRoom && {
        video_room: {
          id: event.videoRoom.id,
          url: event.videoRoom.url,
          moderator_url: event.videoRoom.moderatorUrl,
          provider: event.videoRoom.provider,
        },
      }),
      participants: participantsData,
      ...(currentUserParticipation && { current_user_participation: currentUserParticipation }),
      can_join: canJoin,
      time_to_event: timeToEvent,
    };
  }

  async cancelRegistration(
    eventId: string,
    userId: string
  ): Promise<CancelRegistrationResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['mentor', 'userEvents', 'userEvents.user'],
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    const userEvent = await this.userEventRepository.findOne({
      where: {
        eventId,
        userId,
        status: In([ParticipationStatus.REGISTERED, ParticipationStatus.PENDING]),
      },
      relations: ['user'],
    });

    if (!userEvent) {
      throw new BadRequestException('Вы не записаны на это событие или запись уже отменена');
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user || user.role !== 'student') {
      throw new ForbiddenException('Только студенты могут отменять записи на события');
    }

    const now = new Date();
    if (event.datetimeStart && event.datetimeStart <= now) {
      throw new BadRequestException('Нельзя отменить запись на событие после его начала');
    }

    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Событие уже отменено');
    }

    const previousStatus = userEvent.status;
    const previousPaymentStatus = userEvent.paymentStatus;

    userEvent.status = ParticipationStatus.CANCELLED;
    userEvent.updatedAt = new Date();

    await this.userEventRepository.save(userEvent);

    await this.sendCancellationNotifications(
      event,
      userEvent.user,
      previousStatus,
      previousPaymentStatus
    );

    if (event.type === EventType.SESSION_BASED) {
      await this.handleSessionBasedEventCancellation(event, userId);
    }

    return {
      success: true,
      message: 'Запись на событие успешно отменена',
      cancelled_at: userEvent.updatedAt.toISOString(),
    };
  }

  private async sendCancellationNotifications(
    event: Event,
    student: User,
    previousStatus: ParticipationStatus,
    previousPaymentStatus: PaymentStatus
  ): Promise<void> {
    try {
      await this.sendCancellationNotificationToMentor(event, student, previousStatus);

      await this.sendCancellationConfirmationToStudent(event, student, previousPaymentStatus);

      this.logger.log(`Cancellation notifications sent for event ${event.id}`);
    } catch (error) {
      this.logger.error('Failed to send cancellation notifications:', error);
    }
  }

  private async sendCancellationNotificationToMentor(
    event: Event,
    student: User,
    previousStatus: ParticipationStatus
  ): Promise<void> {
    try {
      const mentor = await this.usersRepository.findOne({
        where: { id: event.mentorId },
      });

      if (!mentor || !mentor.email) {
        this.logger.warn('Mentor not found or has no email for cancellation notification');
        return;
      }

      const studentName = student.fullName || student.email.split('@')[0];
      const formattedDate = event.datetimeStart
        ? new Date(event.datetimeStart).toLocaleString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Moscow',
          })
        : 'не указано';

      await this.emailService.sendMentorCancellationNotification(
        mentor.email,
        mentor.fullName || mentor.email.split('@')[0],
        event.title,
        studentName,
        student.email,
        formattedDate,
        previousStatus
      );

      this.logger.log(`Cancellation notification sent to mentor ${mentor.email}`);
    } catch (error) {
      this.logger.error('Failed to send cancellation notification to mentor:', error);
    }
  }

  private async sendCancellationConfirmationToStudent(
    event: Event,
    student: User,
    previousPaymentStatus: PaymentStatus
  ): Promise<void> {
    try {
      if (!student.email) {
        this.logger.warn('Student has no email for cancellation confirmation');
        return;
      }

      const mentorName = event.mentor.fullName || event.mentor.email.split('@')[0];
      const formattedDate = event.datetimeStart
        ? new Date(event.datetimeStart).toLocaleString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Moscow',
          })
        : 'не указано';

      await this.emailService.sendStudentCancellationConfirmation(
        student.email,
        student.fullName || student.email.split('@')[0],
        event.title,
        mentorName,
        formattedDate,
        event.price,
        previousPaymentStatus === PaymentStatus.PAID
      );

      this.logger.log(`Cancellation confirmation sent to student ${student.email}`);
    } catch (error) {
      this.logger.error('Failed to send cancellation confirmation to student:', error);
    }
  }

  private async handleSessionBasedEventCancellation(event: Event, userId: string): Promise<void> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: event.sessionId },
      });

      if (!session) {
        this.logger.warn(`Session not found for event ${event.id}`);
        return;
      }

      if (session.studentId !== userId) {
        this.logger.warn(`Student ${userId} is not the owner of session ${session.id}`);
        return;
      }

      this.logger.log(`Session ${session.id} marked as cancelled for event ${event.id}`);
    } catch (error) {
      this.logger.error('Failed to handle session-based event cancellation:', error);
    }
  }

  private async getEventParticipants(eventId: string): Promise<ParticipantDto[]> {
    const userEvents = await this.userEventRepository.find({
      where: { eventId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return userEvents.map((userEvent) => ({
      id: userEvent.user.id,
      name: userEvent.user.fullName || userEvent.user.email.split('@')[0],
      avatar: userEvent.user.avatarUrl,
      email: userEvent.user.email,
      status: userEvent.status,
      payment_status: userEvent.paymentStatus,
      registered_at: userEvent.createdAt.toISOString(),
    }));
  }

  private checkIfUserCanJoin(event: Event, userId?: string): boolean {
    const now = new Date();

    if (event.status !== EventStatus.SCHEDULED && event.status !== EventStatus.ACTIVE) {
      return false;
    }

    if (!event.datetimeStart) {
      return false;
    }

    const fifteenMinutesBefore = new Date(event.datetimeStart.getTime() - 15 * 60 * 1000);
    const isWithinTimeWindow = now >= fifteenMinutesBefore && now <= event.datetimeEnd;

    if (!isWithinTimeWindow) {
      return false;
    }

    if (userId) {
      if (event.mentorId === userId) {
        return true;
      }
      return true;
    }

    return false;
  }

  private calculateTimeToEventWithText(
    datetimeStart: Date
  ): { days: number; hours: number; minutes: number; text: string } | null {
    if (!datetimeStart) {
      return null;
    }

    const now = new Date();
    const start = new Date(datetimeStart);

    if (start <= now) {
      return null;
    }

    const deltaMs = start.getTime() - now.getTime();
    const deltaSeconds = Math.floor(deltaMs / 1000);

    const days = Math.floor(deltaSeconds / 86400);
    const hours = Math.floor((deltaSeconds % 86400) / 3600);
    const minutes = Math.floor((deltaSeconds % 3600) / 60);

    const text = this.formatTimeLeftText(days, hours, minutes);

    return {
      days,
      hours,
      minutes,
      text,
    };
  }

  private isUserRegistered(userEvent: UserEvent): boolean {
    return (
      userEvent.status === ParticipationStatus.REGISTERED ||
      userEvent.status === ParticipationStatus.ATTENDED
    );
  }

  private isUserPaid(userEvent: UserEvent): boolean {
    return userEvent.paymentStatus === PaymentStatus.PAID;
  }

  private calculateTimeToEvent(datetimeStart: Date): TimeToEventDto | null {
    const now = new Date();
    const start = new Date(datetimeStart);

    if (start <= now) return null;

    const deltaMs = start.getTime() - now.getTime();
    const deltaSeconds = Math.floor(deltaMs / 1000);

    const days = Math.floor(deltaSeconds / 86400);
    const hours = Math.floor((deltaSeconds % 86400) / 3600);
    const minutes = Math.floor((deltaSeconds % 3600) / 60);

    return {
      days,
      hours,
      minutes,
    };
  }

  private async autoRegisterStudentForSessionEvent(event: Event, session: Session): Promise<void> {
    try {
      const existingRegistration = await this.userEventRepository.findOne({
        where: {
          eventId: event.id,
          userId: session.studentId,
        },
      });

      if (existingRegistration) {
        this.logger.log(`Student ${session.studentId} already registered for event ${event.id}`);
        return;
      }

      const userEvent = this.userEventRepository.create({
        eventId: event.id,
        userId: session.studentId,
        status: ParticipationStatus.REGISTERED,
        paymentStatus: PaymentStatus.PAID,
      });

      await this.userEventRepository.save(userEvent);

      if (event.videoRoom?.externalId) {
        const student = await this.usersRepository.findOne({
          where: { id: session.studentId },
        });

        if (student) {
          try {
            await this.myOwnConferenceService.addAttendeeToWebinar(
              event.videoRoom.externalId,
              student.email,
              student.fullName || student.email.split('@')[0]
            );
            this.logger.log(`Student ${student.email} added to webinar room`);
          } catch (webinarError) {
            this.logger.error(
              'Failed to add student to webinar, but registration saved',
              webinarError
            );
          }
        }
      }

      this.logger.log(
        `Student ${session.studentId} auto-registered for session-based event ${event.id}`
      );
    } catch (error) {
      this.logger.error('Failed to auto-register student for session event', error);
    }
  }

  private calculateTimeLeft(datetimeStart: Date): TimeLeftDto | null {
    if (!datetimeStart) return null;

    const now = new Date();
    const start = new Date(datetimeStart);

    if (start <= now) return null;

    const deltaMs = start.getTime() - now.getTime();
    const deltaSeconds = Math.floor(deltaMs / 1000);

    const days = Math.floor(deltaSeconds / 86400);
    const hours = Math.floor((deltaSeconds % 86400) / 3600);
    const minutes = Math.floor((deltaSeconds % 3600) / 60);

    const text = this.formatTimeLeftText(days, hours, minutes);

    return {
      days,
      hours,
      minutes,
      text,
    };
  }

  private formatTimeLeftText(days: number, hours: number, minutes: number): string {
    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days} ${this.getRussianWord(days, ['день', 'дня', 'дней'])}`);
    }

    if (hours > 0) {
      parts.push(`${hours} ${this.getRussianWord(hours, ['час', 'часа', 'часов'])}`);
    }

    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes} ${this.getRussianWord(minutes, ['минута', 'минуты', 'минут'])}`);
    }

    return `До события: ${parts.join(' ')}`;
  }
}
