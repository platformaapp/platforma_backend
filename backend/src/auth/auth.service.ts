import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/user.entity';
import { AuthSession } from './auth.entity';
import { RegisterDto } from './dto/registration.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse } from 'src/utils/types';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from 'src/utils/sendEmail';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { JWT_SECRET } from 'src/utils/constants';
import { JwtError, PasswordResetPayload } from 'src/utils/types';

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
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
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
      role: registerDto.role,
      phone: registerDto.phone || null,
      avatarUrl: registerDto.avatarUrl || null,
      bio: registerDto.bio || null,
    });

    const savedUser = await this.usersRepository.save(user);

    const payload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();

    const authSession = this.authSessionRepository.create({
      user: savedUser,
      refreshToken: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isValid: true,
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

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
      role: user.role,
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

    if (!user) return;

    const resetToken = this.generatePasswordResetToken(user.id, user.email);

    console.log('Reset Token:', resetToken);

    try {
      return await sendPasswordResetEmail(user.email, resetToken, user.fullName);
    } catch (error) {
      console.error(
        'Failed to send password reset email:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new Error('Failed to send password reset email');
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    try {
      const { reset_token, password } = resetPasswordDto;

      if (!reset_token || typeof reset_token !== 'string' || reset_token.split('.').length !== 3) {
        throw new UnauthorizedException('Invalid reset token format');
      }

      const jwtSecret = this.configService.get<string>('JWT_SECRET') || JWT_SECRET;

      try {
        const payload = this.jwtService.verify<PasswordResetPayload>(reset_token, {
          secret: jwtSecret,
        });

        if (payload.type !== 'password_reset') {
          throw new UnauthorizedException('Invalid reset token type');
        }

        const user = await this.usersRepository.findOne({
          where: { id: payload.sub },
        });

        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(password, saltRounds);

        user.passwordHash = newPasswordHash;
        await this.usersRepository.save(user);

        await this.authSessionRepository.update(
          { user: { id: user.id }, isValid: true },
          { isValid: false }
        );
      } catch (jwtError: unknown) {
        if (isJwtError(jwtError)) {
          if (jwtError.name === 'TokenExpiredError') {
            throw new UnauthorizedException('Reset token has expired');
          }
          if (jwtError.name === 'JsonWebTokenError') {
            throw new UnauthorizedException('Invalid reset token');
          }
        }

        if (jwtError instanceof UnauthorizedException) {
          throw jwtError;
        }
        console.error(
          'JWT verification error:',
          jwtError instanceof Error ? jwtError.message : 'Unknown error'
        );
        throw new UnauthorizedException('Invalid reset token');
      }
    } catch (error) {
      console.error(
        'Error resetting password:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Failed to reset password');
    }
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
}
