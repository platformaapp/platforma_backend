import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/user.entity';
import { Event } from 'src/events/entities/event.entity';
import { TutorApplication } from './entities/tutor-application.entity';
import { PlatformSettings } from './entities/platform-settings.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { GetApplicationsDto } from './dto/get-applications.dto';
import { JWT_SECRET } from 'src/utils/constants';
import { EmailService } from 'src/notifications/email.service';
import { AdminModerateEventDto } from './dto/moderate-event.dto';

const COMMISSION_KEY = 'commission_rate';

const ADMIN_TOKEN_TTL = '30d';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(TutorApplication)
    private applicationsRepository: Repository<TutorApplication>,
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(PlatformSettings)
    private settingsRepository: Repository<PlatformSettings>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService
  ) {}

  async login(dto: AdminLoginDto): Promise<{ token: string }> {
    const user = await this.usersRepository.findOne({ where: { email: dto.email } });

    if (!user || !user.roles?.includes('admin')) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const secret = this.configService.get<string>('JWT_SECRET') ?? JWT_SECRET;
    const token = this.jwtService.sign(
      { sub: user.id, email: user.email, role: 'admin' },
      { secret, expiresIn: ADMIN_TOKEN_TTL }
    );

    return { token };
  }

  async getApplications(dto: GetApplicationsDto) {
    const page = dto.page ?? 1;
    const perPage = dto.per_page ?? 20;
    const skip = (page - 1) * perPage;

    const where = dto.status ? { status: dto.status } : {};

    const [items, total] = await this.applicationsRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: perPage,
    });

    const mapped = items.map((app) => ({
      id: app.id,
      status: app.status,
      createdAt: app.createdAt,
      rejectionReason: app.rejectionReason,
      user: {
        id: app.user.id,
        fullName: app.user.fullName,
        email: app.user.email,
        phone: app.user.phone,
        bio: app.user.bio,
        specialization: app.user.specialization,
        avatarUrl: app.user.avatarUrl,
      },
    }));

    return {
      items: mapped,
      pagination: { total },
    };
  }

  async approveApplication(id: string): Promise<void> {
    const application = await this.applicationsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!application) throw new NotFoundException('Заявка не найдена');

    application.status = 'approved';
    await this.applicationsRepository.save(application);

    const user = application.user;
    if (!user.roles?.includes('tutor')) {
      user.roles = [...(user.roles ?? []), 'tutor'];
      await this.usersRepository.save(user);
    }
  }

  async rejectApplication(id: string, reason?: string): Promise<void> {
    const application = await this.applicationsRepository.findOne({ where: { id } });
    if (!application) throw new NotFoundException('Заявка не найдена');

    application.status = 'rejected';
    application.rejectionReason = reason ?? null;
    await this.applicationsRepository.save(application);
  }

  // ── Platform commission ──────────────────────────────────────────────────

  async getPlatformCommission(): Promise<{ commissionRate: number }> {
    const row = await this.settingsRepository.findOne({ where: { key: COMMISSION_KEY } });
    return { commissionRate: row ? Number(row.value) : 0 };
  }

  async setPlatformCommission(rate: number): Promise<void> {
    if (rate < 0 || rate > 100) throw new BadRequestException('Комиссия должна быть от 0 до 100');
    await this.settingsRepository.upsert({ key: COMMISSION_KEY, value: String(rate) }, ['key']);
  }

  // ── Tutor-specific commission ────────────────────────────────────────────

  async setTutorCommission(userId: string, rate: number | null): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (!user.roles?.includes('tutor')) throw new BadRequestException('Пользователь не является наставником');
    if (rate !== null && (rate < 0 || rate > 100))
      throw new BadRequestException('Комиссия должна быть от 0 до 100');
    user.commissionRate = rate;
    await this.usersRepository.save(user);
  }

  // ── Block / unblock users ────────────────────────────────────────────────

  async getUsers(page: number, perPage: number, role?: string, search?: string) {    const skip = (page - 1) * perPage;
    const qb = this.usersRepository.createQueryBuilder('user').orderBy('user.createdAt', 'DESC');

    if (role) {
      qb.andWhere(':role = ANY(string_to_array(user.roles, \',\'))', { role });
    }
    if (search) {
      qb.andWhere('(user.email ILIKE :s OR user.fullName ILIKE :s)', { s: `%${search}%` });
    }

    const [items, total] = await qb.skip(skip).take(perPage).getManyAndCount();

    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        roles: u.roles,
        isBlocked: u.isBlocked,
        commissionRate: u.commissionRate,
        createdAt: u.createdAt,
      })),
      pagination: { total, page, per_page: perPage },
    };
  }

  async getUserById(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const { passwordHash: _, ...rest } = user;
    void _;

    const application = await this.applicationsRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      ...rest,
      applicationStatus: application?.status ?? null,
      rejectionReason: application?.rejectionReason ?? null,
    };
  }

  async blockUser(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (user.roles?.includes('admin')) throw new BadRequestException('Нельзя заблокировать администратора');
    user.isBlocked = true;
    await this.usersRepository.save(user);
  }

  async unblockUser(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    user.isBlocked = false;
    await this.usersRepository.save(user);
  }

  // ── Block / unblock events ───────────────────────────────────────────────

  async getEvents(page: number, perPage: number, search?: string) {
    const skip = (page - 1) * perPage;
    const qb = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.mentor', 'mentor')
      .orderBy('event.createdAt', 'DESC');

    if (search) {
      qb.andWhere('event.title ILIKE :s', { s: `%${search}%` });
    }

    const [items, total] = await qb.skip(skip).take(perPage).getManyAndCount();

    return {
      items: items.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        isBlocked: e.isBlocked,
        price: Number(e.price),
        datetimeStart: e.datetimeStart,
        mentor: e.mentor
          ? { id: e.mentor.id, fullName: e.mentor.fullName, email: e.mentor.email }
          : null,
        createdAt: e.createdAt,
      })),
      pagination: { total, page, per_page: perPage },
    };
  }

  async getEventById(eventId: string) {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['mentor', 'videoRoom', 'userEvents', 'session'],
    });
    if (!event) throw new NotFoundException('Событие не найдено');

    const paidCount = event.userEvents?.filter((ue) => ue.paymentStatus === 'paid').length ?? 0;
    const registeredCount = event.userEvents?.filter((ue) =>
      ['registered', 'pending', 'attended'].includes(ue.status)
    ).length ?? 0;

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.type,
      status: event.status,
      isBlocked: event.isBlocked,
      price: Number(event.price),
      platformFee: Number(event.platformFee),
      mentorRevenue: Number(event.mentorRevenue),
      maxParticipants: event.maxParticipants,
      durationMinutes: event.durationMinutes,
      datetimeStart: event.datetimeStart,
      datetimeEnd: event.datetimeEnd,
      coverUrl: event.coverUrl,
      recordingUrl: event.recordingUrl,
      sessionId: event.sessionId,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      mentor: event.mentor
        ? {
            id: event.mentor.id,
            fullName: event.mentor.fullName,
            email: event.mentor.email,
            avatarUrl: event.mentor.avatarUrl,
          }
        : null,
      videoRoom: event.videoRoom
        ? {
            id: event.videoRoom.id,
            provider: event.videoRoom.provider,
            url: event.videoRoom.url,
            moderatorUrl: event.videoRoom.moderatorUrl,
            externalId: event.videoRoom.externalId,
            isActive: event.videoRoom.isActive,
            expiresAt: event.videoRoom.expiresAt,
          }
        : null,
      participants: {
        total: registeredCount,
        paid: paidCount,
      },
    };
  }

  async blockEvent(eventId: string): Promise<void> {    const event = await this.eventsRepository.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Событие не найдено');
    event.isBlocked = true;
    await this.eventsRepository.save(event);
  }

  async unblockEvent(eventId: string): Promise<void> {
    const event = await this.eventsRepository.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Событие не найдено');
    event.isBlocked = false;
    await this.eventsRepository.save(event);
  }

  async moderateEvent(eventId: string, dto: AdminModerateEventDto): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['mentor'],
    });
    if (!event) throw new NotFoundException('Событие не найдено');

    const changes = {
      coverChanged: dto.coverUrl !== undefined,
      titleChanged: dto.title !== undefined,
      descriptionChanged: dto.description !== undefined,
    };

    if (dto.coverUrl !== undefined) event.coverUrl = dto.coverUrl;
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;

    event.adminModerationComment = dto.comment ?? null;

    const saved = await this.eventsRepository.save(event);

    if (event.mentor?.email && Object.values(changes).some(Boolean)) {
      await this.emailService.sendEventModerationEmail({
        email: event.mentor.email,
        tutorName: event.mentor.fullName ?? '',
        eventTitle: saved.title,
        changes,
        newCoverUrl: dto.coverUrl,
        comment: dto.comment,
      });
    }

    return saved;
  }
}
