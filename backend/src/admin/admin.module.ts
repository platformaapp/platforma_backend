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
import { AdminArticlesController } from './admin-articles.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { TutorApplication } from './entities/tutor-application.entity';
import { PlatformSettings } from './entities/platform-settings.entity';
import { User } from 'src/users/user.entity';
import { Event } from 'src/events/entities/event.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { UserEvent } from 'src/events/entities/user-event.entity';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { JWT_SECRET } from 'src/utils/constants';
import { EmailService } from 'src/notifications/email.service';
import { ArticlesModule } from 'src/articles/articles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TutorApplication, PlatformSettings, User, Event, Payment, UserEvent]),
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? JWT_SECRET,
      }),
      inject: [ConfigService],
    }),
    ArticlesModule,
  ],
  controllers: [
    AdminAuthController,
    AdminTutorApplicationsController,
    AdminSettingsController,
    AdminUsersController,
    AdminEventsController,
    AdminArticlesController,
    AdminPaymentsController,
  ],
  providers: [
    AdminService,
    AdminJwtStrategy,
    AdminJwtGuard,
    EmailService,
    ConfigService,
    AdminPaymentsService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
