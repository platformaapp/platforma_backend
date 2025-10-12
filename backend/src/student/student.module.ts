// src/student/student.module.ts
import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Slot } from '../slots/entities/slot.entity';
import { User } from '../users/user.entity';
import { SlotsModule } from '../slots/slots.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { BookingMapper } from 'src/mapper/booking.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Slot, User]), SlotsModule, UsersModule, AuthModule],
  controllers: [StudentController],
  providers: [StudentService, BookingMapper],
  exports: [StudentService, BookingMapper],
})
export class StudentModule {}
