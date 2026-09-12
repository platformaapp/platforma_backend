import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from 'src/users/user.entity';
import { AuthSession } from './auth.entity';
import { RegisterDto } from './dto/registration.dto';
import { LoginDto } from './dto/login.dto';
import {
  AccountDeletionPayload,
  AuthResponse,
  JwtError,
  PasswordResetPayload,
} from 'src/utils/types';
import { randomBytes } from 'crypto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { JWT_SECRET } from 'src/utils/constants';
import { EmailService } from '../notifications/email.service';
import { TutorApplication } from 'src/admin/entities/tutor-application.entity';
import { PaymentMethod } from 'src/payments/entities/payment-method.entity';

function isJwtError(error: unknown): error is JwtError {
  return (
    error instanceof Error &&
    ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)
  );
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(AuthSession)
    private authSessionRepository: Repository<AuthSession>,
    @InjectRepository(TutorApplication)
    private tutorApplicationRepository: Repository<TutorApplication>,
    @InjectRepository(PaymentMethod)
    private paymentMethodRepository: Repository<PaymentMethod>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const emailDomain = registerDto.email.split('@')[1]?.toLowerCase();
    const blockedDomains = ['gmail.com', 'googlemail.com'];
    if (blockedDomains.includes(emailDomain)) {
      throw new BadRequestException(
        'Регистрация с почтой Gmail недоступна. Пожалуйста, используйте другой email.'
      );
    }

    const existingUser = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      const currentRoles: UserRole[] = existingUser.roles ?? [];
      if (currentRoles.includes(registerDto.role)) {
        throw new ConflictException(`User already registered with role: ${registerDto.role}`);
      }

      existingUser.roles = [...currentRoles, registerDto.role];
      const updatedUser = await this.usersRepository.save(existingUser);

      if (registerDto.role === 'tutor') {
        const existingApplication = await this.tutorApplicationRepository.findOne({
          where: { userId: existingUser.id },
          order: { createdAt: 'DESC' },
        });
        if (!existingApplication) {
          await this.tutorApplicationRepository.save(
            this.tutorApplicationRepository.create({ userId: existingUser.id, status: 'pending' })
          );
          void this.emailService.sendTutorApplicationNotification({
            fullName: existingUser.fullName,
            email: existingUser.email,
            phone: existingUser.phone,
            telegram: existingUser.telegram,
          });
        }
      }

      const payload = {
        sub: updatedUser.id,
        email: updatedUser.email,
        role: registerDto.role,
        roles: updatedUser.roles,
      };

      const accessToken = this.jwtService.sign(payload);
      const refreshToken = this.generateRefreshToken();

      const authSession = this.authSessionRepository.create({
        user: updatedUser,
        refreshToken: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isValid: true,
        activeRole: registerDto.role,
      });

      await this.authSessionRepository.save(authSession);

      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      void _;

      return {
        user: userWithoutPassword,
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    }

    if (registerDto.phone) {
      const existingUserByPhone = await this.usersRepository.findOne({
        where: { phone: registerDto.phone },
      });

      if (existingUserByPhone) {
        throw new ConflictException('User with this phone number already exists');
      }
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    const user = this.usersRepository.create({
      email: registerDto.email,
      passwordHash: passwordHash,
      fullName: registerDto.fullName,
      roles: [registerDto.role],
      phone: registerDto.phone || null,
      telegram: registerDto.telegram || null,
      avatarUrl: registerDto.avatarUrl || null,
      bio: registerDto.bio || null,
    });

    const savedUser = await this.usersRepository.save(user);

    if (registerDto.role === 'tutor') {
      await this.tutorApplicationRepository.save(
        this.tutorApplicationRepository.create({ userId: savedUser.id, status: 'pending' })
      );
      void this.emailService.sendTutorApplicationNotification({
        fullName: savedUser.fullName,
        email: savedUser.email,
        phone: savedUser.phone,
        telegram: savedUser.telegram,
      });
    }

    const payload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: registerDto.role,
      roles: savedUser.roles,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();

    const authSession = this.authSessionRepository.create({
      user: savedUser,
      refreshToken: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isValid: true,
      activeRole: registerDto.role,
    });

    await this.authSessionRepository.save(authSession);

    const { passwordHash: _, ...userWithoutPassword } = savedUser;
    void _;

    return {
      user: userWithoutPassword,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.roles?.includes(loginDto.role)) {
      throw new UnauthorizedException(`You don't have ${loginDto.role} role`);
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: loginDto.role,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);

    await this.authSessionRepository.update(
      { user: { id: user.id }, isValid: true },
      { isValid: false }
    );

    const refreshToken = this.generateRefreshToken();

    const authSession = this.authSessionRepository.create({
      user: user,
      refreshToken: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isValid: true,
      activeRole: loginDto.role,
    });

    await this.authSessionRepository.save(authSession);

    const { passwordHash: _, ...userWithoutPassword } = user;
    void _;

    return {
      user: userWithoutPassword,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const session = await this.authSessionRepository.findOne({
      where: {
        refreshToken: refreshToken,
        isValid: true,
        expiresAt: MoreThanOrEqual(new Date()),
      },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = session.user;
    const newAccessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: session.activeRole,
      roles: user.roles,
    });

    const newRefreshToken = this.generateRefreshToken();

    session.refreshToken = newRefreshToken;
    session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.authSessionRepository.save(session);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.authSessionRepository.findOne({
      where: { refreshToken, isValid: true },
    });

    if (session) {
      session.isValid = false;
      await this.authSessionRepository.save(session);
    }
  }

  async requestPasswordChange({ email }: { email: string }): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { email },
    });

    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    const resetToken = this.generatePasswordResetToken(user.id, user.email);

    // Fire-and-forget: do not block HTTP response while SMTP is connecting
    setImmediate(() => {
      this.emailService
        .sendPasswordResetEmail(user.email, resetToken, user.fullName)
        .then(() => console.log(`Password reset email sent successfully to ${email}`))
        .catch((error: unknown) =>
          console.error(
            'Failed to send password reset email:',
            error instanceof Error ? error.message : 'Unknown error'
          )
        );
    });
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { reset_token, password } = resetPasswordDto;

    if (!reset_token || typeof reset_token !== 'string' || reset_token.split('.').length !== 3) {
      throw new UnauthorizedException('Invalid reset token format');
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || JWT_SECRET;

    let payload: PasswordResetPayload;
    try {
      payload = this.jwtService.verify<PasswordResetPayload>(reset_token, { secret: jwtSecret });
    } catch (jwtError: unknown) {
      if (isJwtError(jwtError) && jwtError.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Reset token has expired');
      }
      throw new UnauthorizedException('Invalid reset token');
    }

    if (payload.type !== 'password_reset') {
      throw new UnauthorizedException('Invalid reset token type');
    }

    const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');

    user.passwordHash = await bcrypt.hash(password, 12);
    await this.usersRepository.save(user);
    console.log(`[resetPassword] Password updated for user ${user.id}`);

    try {
      await this.authSessionRepository.update(
        { user: { id: user.id }, isValid: true },
        { isValid: false }
      );
    } catch (sessionError: unknown) {
      console.error(
        '[resetPassword] Failed to invalidate sessions:',
        sessionError instanceof Error ? sessionError.message : sessionError
      );
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Текущий пароль неверный');

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersRepository.save(user);
  }

  /** Запрос на удаление аккаунта без входа в приложение (публичная веб-страница) — присылает ссылку-подтверждение на почту. */
  async requestAccountDeletion({ email }: { email: string }): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user || user.deletedAt) {
      console.log(`Account deletion requested for non-existent or already-deleted email: ${email}`);
      return;
    }

    const deletionToken = this.generateAccountDeletionToken(user.id, user.email);

    setImmediate(() => {
      this.emailService
        .sendAccountDeletionEmail(user.email, deletionToken, user.fullName)
        .then(() => console.log(`Account deletion email sent successfully to ${email}`))
        .catch((error: unknown) =>
          console.error(
            'Failed to send account deletion email:',
            error instanceof Error ? error.message : 'Unknown error'
          )
        );
    });
  }

  /** Подтверждение удаления по ссылке из письма — используется публичной веб-страницей без авторизации. */
  async confirmAccountDeletion(token: string): Promise<void> {
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      throw new UnauthorizedException('Invalid deletion token format');
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || JWT_SECRET;

    let payload: AccountDeletionPayload;
    try {
      payload = this.jwtService.verify<AccountDeletionPayload>(token, { secret: jwtSecret });
    } catch (jwtError: unknown) {
      if (isJwtError(jwtError) && jwtError.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Deletion link has expired');
      }
      throw new UnauthorizedException('Invalid deletion link');
    }

    if (payload.type !== 'account_deletion') {
      throw new UnauthorizedException('Invalid deletion token type');
    }

    const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.deletedAt) return; // already deleted — idempotent

    await this.performAccountDeletion(user);
  }

  /** Удаление своего аккаунта из приложения — требует подтверждения паролем. */
  async deleteOwnAccount(userId: string, password: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.deletedAt) return; // already deleted — idempotent

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный пароль');
    }

    await this.performAccountDeletion(user);
  }

  /**
   * Обезличивает персональные данные пользователя вместо жёсткого удаления строки:
   * записи о событиях/бронированиях/платежах ссылаются на users.id и должны остаться
   * для истории и бухгалтерии, поэтому удаляем только PII и то, что не несёт
   * финансовой/юридической ценности (способы оплаты, активные сессии).
   */
  private async performAccountDeletion(user: User): Promise<void> {
    user.email = `deleted-${user.id}@deleted.platformaapp.ru`;
    user.phone = null;
    user.telegram = null;
    user.fullName = 'Удалённый пользователь';
    user.avatarUrl = null;
    user.bio = null;
    user.shortBio = null;
    user.hourlyRate = null;
    user.specialization = null;
    user.groupMeetings = null;
    user.payoutMethod = null;
    user.payoutDestination = null;
    user.defaultPaymentMethodId = null;
    user.passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    user.isBlocked = true;
    user.deletedAt = new Date();
    await this.usersRepository.save(user);

    await this.paymentMethodRepository.delete({ user: { id: user.id } });

    await this.authSessionRepository.update(
      { user: { id: user.id }, isValid: true },
      { isValid: false }
    );

    console.log(`[performAccountDeletion] Account ${user.id} anonymized and deactivated`);
  }

  async switchRole(userId: string, refreshToken: string, newRole: UserRole) {
    const session = await this.authSessionRepository.findOne({
      where: {
        refreshToken: refreshToken,
        isValid: true,
        expiresAt: MoreThanOrEqual(new Date()),
      },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (session.user.id !== userId) {
      throw new UnauthorizedException('Session does not belong to this user');
    }

    if (!session.user.roles.includes(newRole)) {
      throw new UnauthorizedException(`You don't have ${newRole} role`);
    }

    session.activeRole = newRole;
    await this.authSessionRepository.save(session);

    const newAccessToken = this.jwtService.sign({
      sub: session.user.id,
      email: session.user.email,
      role: newRole,
      roles: session.user.roles,
    });

    const { passwordHash: _, ...userWithoutPassword } = session.user;
    void _;

    return {
      user: userWithoutPassword,
      access_token: newAccessToken,
      active_role: newRole,
    };
  }

  private generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  private generatePasswordResetToken(userId: string, email: string): string {
    const payload = {
      sub: userId,
      email: email,
      type: 'password_reset',
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || JWT_SECRET;

    return this.jwtService.sign(payload, {
      expiresIn: '1h',
      secret: jwtSecret,
    });
  }

  private generateAccountDeletionToken(userId: string, email: string): string {
    const payload = {
      sub: userId,
      email: email,
      type: 'account_deletion',
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || JWT_SECRET;

    return this.jwtService.sign(payload, {
      expiresIn: '1h',
      secret: jwtSecret,
    });
  }
}
