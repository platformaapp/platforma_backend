import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/user.entity';
import { AuthSession } from './entities/auth.entity';
import { RegisterDto } from './dto/registration.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse } from 'src/utils/helper';
import { randomBytes } from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(AuthSession)
    private authSessionRepository: Repository<AuthSession>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
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
      refreshToken: await this.hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isValid: true,
    });

    await this.authSessionRepository.save(authSession);

    const { passwordHash: _, ...userWithoutPassword } = savedUser;

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

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();

    await this.authSessionRepository.update(
      { user: { id: user.id }, isValid: true },
      { isValid: false },
    );

    const authSession = this.authSessionRepository.create({
      user: user,
      refreshToken: await this.hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isValid: true,
    });

    await this.authSessionRepository.save(authSession);

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const authSessions = await this.authSessionRepository.find({
        where: {
          isValid: true,
          expiresAt: MoreThanOrEqual(new Date()),
        },
        relations: ['user'],
      });

      let validSession: AuthSession | null = null;
      for (const session of authSessions) {
        const isTokenValid = await bcrypt.compare(
          refreshToken,
          session.refreshToken,
        );
        if (isTokenValid) {
          validSession = session;
          break;
        }
      }

      if (!validSession) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = validSession.user;

      const newAccessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const newRefreshToken = this.generateRefreshToken();

      validSession.refreshToken = await this.hashRefreshToken(newRefreshToken);
      validSession.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await this.authSessionRepository.save(validSession);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (error) {
      console.error('Refresh error:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  private async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }
}
