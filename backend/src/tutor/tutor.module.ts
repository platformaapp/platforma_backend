import { Module } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { TutorController } from './tutor.controller';
import { User } from 'src/users/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Slot } from 'src/slots/entities/slot.entity';
import { Event } from 'src/events/entities/event.entity';
import { Payment } from 'src/payments/entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Slot, Event, Payment]), AuthModule],
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}
