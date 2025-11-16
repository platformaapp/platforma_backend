import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../session/entities/session.entity';
import { User } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { UserEvent } from './entities/user-event.entity';
import { VideoRoom } from './entities/video-room.entity';
import { Event } from './entities/event.entity';
import { EmailService } from '../notifications/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, User, UserEvent, VideoRoom, Event]),
    AuthModule,
    JwtModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, EmailService],
})
export class EventsModule {}
