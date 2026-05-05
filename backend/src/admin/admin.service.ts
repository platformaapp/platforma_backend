import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/user.entity';
import { TutorApplication } from './entities/tutor-application.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { GetApplicationsDto } from './dto/get-applications.dto';
import { JWT_SECRET } from 'src/utils/constants';

const ADMIN_TOKEN_TTL = '30d';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(TutorApplication)
    private applicationsRepository: Repository<TutorApplication>,
    private jwtService: JwtService,
    private configService: ConfigService
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
}
