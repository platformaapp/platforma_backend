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
import { Event, EventStatus } from './entities/event.entity';
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
    private readonly userRepository: Repository<User>
  ) {}

  async createEvent(createEventDto: CreateEventDto, mentorId: string): Promise<Event> {
    const startDate = new Date(createEventDto.datetime_start);
    const endDate = new Date(createEventDto.datetime_end);
    const now = new Date();

    if (startDate >= endDate) {
      throw new BadRequestException('Время окончания должно быть позже времени начала');
    }

    if (startDate <= now) {
      throw new BadRequestException('Время начала должно быть в будущем');
    }

    const mentor = await this.usersRepository.findOne({
      where: { id: mentorId, role: 'tutor' },
    });

    if (!mentor) {
      throw new ForbiddenException('Только наставники могут создавать события');
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
    });

    const savedEvent = await this.eventsRepository.save(event);

    try {
      const webinarResponse = await this.myOwnConferenceService.createWebinar({
        name: savedEvent.title,
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
    } catch (error) {
      this.logger.error('Failed to create webinar room', error);
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
      datetime_start: event.datetimeStart.toISOString(),
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
      datetime_end: event.datetimeEnd.toISOString(),
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

  private calculateDurationMinutes(start: Date, end: Date): number {
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60));
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
      relations: ['videoRoom', 'userEvents', 'mentor', 'userEvents.user'],
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
      const successfulPayments = await this.paymentRepository.find({
        where: {
          userId: userId,
          status: PaymentEntityStatus.SUCCESS,
        },
      });

      this.logger.log(`Found ${successfulPayments.length} successful payments for user`);

      successfulPayments.forEach((payment) => {
        this.logger.log(
          `Payment: ${payment.id}, Amount: ${payment.amount}, Session: ${payment.sessionId}`
        );
      });

      const hasSuccessfulPayment = successfulPayments.length > 0;

      this.logger.log(`hasSuccessfulPayment: ${hasSuccessfulPayment}`);

      if (!hasSuccessfulPayment) {
        throw new ForbiddenException('Необходимо оплатить событие для доступа к видеочату');
      }

      if (userRegistration && userRegistration.paymentStatus !== PaymentStatus.PAID) {
        this.logger.log(`Updating user registration payment status to PAID`);
        userRegistration.paymentStatus = PaymentStatus.PAID;
        await this.userEventRepository.save(userRegistration);
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
        return {
          join_url: event.videoRoom.moderatorUrl,
        };
      }

      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('Пользователь не найден');

      const attendeeLink = await this.myOwnConferenceService.getAttendeeLink(
        event.videoRoom.externalId,
        user.email
      );

      return {
        join_url: attendeeLink || event.videoRoom.url,
      };
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

    if (page < 1) throw new BadRequestException('invalid_page');

    if (limit < 1 || limit > 100) throw new BadRequestException('invalid_limit');

    const skip = (page - 1) * limit;

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

    const items: EventFeedItemDto[] = await Promise.all(
      events.map(async (event) => {
        let isRegistered = false;
        let isPaid = false;

        if (userId) {
          const userEvent = await this.userEventRepository.findOne({
            where: {
              event: { id: event.id },
              user: { id: userId },
              status: ParticipationStatus.REGISTERED,
            },
          });

          isRegistered = !!userEvent;
          isPaid = userEvent?.paymentStatus === PaymentStatus.PAID;
        }

        const timeToEvent = this.calculateTimeToEvent(event.datetimeStart);

        const mentor: MentorDto = {
          id: event.mentor.id,
          name: event.mentor.fullName,
          avatarUrl: event.mentor.avatarUrl,
        };

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          datetimeStart: event.datetimeStart.toISOString(),
          timeToEvent,
          durationMinutes: event.durationMinutes,
          coverUrl: null,
          price: Number(event.price),
          mentor,
          ...(userId && {
            isRegistered,
            isPaid,
          }),
          status: event.status,
        };
      })
    );

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
}
