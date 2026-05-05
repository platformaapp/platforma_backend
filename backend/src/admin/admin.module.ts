import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminTutorApplicationsController } from './admin-tutor-applications.controller';
import { TutorApplication } from './entities/tutor-application.entity';
import { User } from 'src/users/user.entity';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { JWT_SECRET } from 'src/utils/constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([TutorApplication, User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? JWT_SECRET,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminAuthController, AdminTutorApplicationsController],
  providers: [AdminService, AdminJwtStrategy, AdminJwtGuard],
  exports: [AdminService],
})
export class AdminModule {}
