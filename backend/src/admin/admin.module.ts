import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminTutorApplicationsController } from './admin-tutor-applications.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminEventsController } from './admin-events.controller';
import { TutorApplication } from './entities/tutor-application.entity';
import { PlatformSettings } from './entities/platform-settings.entity';
import { User } from 'src/users/user.entity';
import { Event } from 'src/events/entities/event.entity';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { JWT_SECRET } from 'src/utils/constants';
import { EmailService } from 'src/notifications/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TutorApplication, PlatformSettings, User, Event]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? JWT_SECRET,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminTutorApplicationsController,
    AdminSettingsController,
    AdminUsersController,
    AdminEventsController,
  ],
  providers: [AdminService, AdminJwtStrategy, AdminJwtGuard, EmailService],
  exports: [AdminService],
})
export class AdminModule {}
