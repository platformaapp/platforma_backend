import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Slot, SlotStatus } from '../slots/entities/slot.entity';
import { User } from '../users/user.entity';
import { BookingDetails } from 'src/utils/types';
import { BookingMapper } from 'src/mapper/booking.mapper';
import { Session, SessionStatus } from '../session/entities/session.entity';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

    private readonly dataSource: DataSource,
    private readonly bookingMapper: BookingMapper
  ) {}

  async createBooking(studentId: string, slotId: string): Promise<BookingDetails> {
    this.logger.log(`Creating a booking: studentId=${studentId}, slotId=${slotId}`);

    return await this.dataSource.transaction(async (manager): Promise<BookingDetails> => {
      const slot = await manager.findOne(Slot, {
        where: { id: slotId },
        relations: ['tutor'],
      });

      if (!slot) {
        this.logger.warn(`Slot not found: ${slotId}`);
        throw new NotFoundException('Slot not found');
      }

      this.logger.log(`Slot found: ${slot.id}, status: ${slot.status}, tutor: ${slot.tutor.id}`);

      if (slot.status !== SlotStatus.FREE) {
        this.logger.warn(`The slot is already taken: ${slotId}, status: ${slot.status}`);
        throw new ConflictException('The slot is already taken');
      }

      if (slot.tutor.id === studentId) {
        this.logger.warn(`A student is trying to book his slot: ${studentId}`);
        throw new BadRequestException('You cannot book your own slot');
      }

      const slotDateTime = new Date(`${slot.date}T${slot.time}`);
      if (slotDateTime < new Date()) {
        this.logger.warn(`Attempt to book a past slot: ${slot.date} ${slot.time}`);
        throw new BadRequestException('You cannot reserve a past slot.');
      }

      const student = await manager.findOne(User, {
        where: { id: studentId, role: 'student' },
      });

      if (!student) {
        this.logger.warn(`Student not found or invalid role: ${studentId}`);
        throw new NotFoundException('Student not found or user has invalid role');
      }

      const existingBooking = await manager.findOne(Booking, {
        where: { slotId },
      });

      if (existingBooking) {
        this.logger.warn(`The slot is already booked: ${slotId}`);
        throw new ConflictException('This slot is already booked');
      }

      const booking = manager.create(Booking, {
        slotId: slot.id,
        tutorId: slot.tutor.id,
        studentId: student.id,
        status: BookingStatus.PENDING,
      });

      this.logger.log(`Booking created: ${JSON.stringify(booking)}`);

      slot.status = SlotStatus.BOOKED;
      await manager.save(slot);
      const savedBooking = await manager.save(booking);

      const sessionDuration = 60;
      const sessionEndTime = new Date(slotDateTime.getTime() + sessionDuration * 60000);

      const session = manager.create(Session, {
        tutorId: slot.tutor.id,
        studentId: studentId,
        startTime: slotDateTime,
        endTime: sessionEndTime,
        price: slot.price,
        status: SessionStatus.PLANNED,
      });

      const savedSession = await manager.save(session);

      this.logger.log(
        `Booking ${savedBooking.id} and session ${savedSession.id} created, waiting for payment`
      );

      return this.bookingMapper.mapToBookingWithSession(
        savedBooking,
        slot,
        student,
        slot.tutor,
        savedSession
      );
    });
  }

  async getStudentBookings(studentId: string): Promise<BookingDetails[]> {
    const bookings = await this.bookingRepository.find({
      where: { studentId },
      relations: ['slot', 'slot.tutor', 'student', 'tutor'],
      order: { createdAt: 'DESC' },
    });

    return this.bookingMapper.mapToBookingDetailsList(bookings);
  }

  async cancelBooking(studentId: string, bookingId: string): Promise<BookingDetails> {
    this.logger.log(`Cancellation of booking: studentId=${studentId}, bookingId=${bookingId}`);

    return await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['slot'],
      });

      if (!booking) {
        this.logger.warn(`Booking not found: ${bookingId}`);
        throw new NotFoundException('Booking not found');
      }

      if (booking.studentId !== studentId) {
        this.logger.warn(
          `Trying to cancel someone else's booking: studentId=${studentId}, booking.studentId=${booking.studentId}`
        );
        throw new ForbiddenException("You can not cancel someone else's booking");
      }

      if (booking.status === BookingStatus.CANCELLED) {
        this.logger.warn(`Booking has already been cancelled.: ${bookingId}`);
        throw new BadRequestException('Booking has already been cancelled.');
      }

      const slot = await manager.findOne(Slot, {
        where: { id: booking.slotId },
      });

      if (!slot) {
        this.logger.warn(`Slot not found: ${booking.slotId}`);
        throw new NotFoundException('Slot not found');
      }

      const slotDateTime = new Date(`${slot.date}T${slot.time}`);
      const now = new Date();

      if (slotDateTime < now) {
        this.logger.warn(
          `Attempt to cancel a past session: ${slotDateTime.toISOString()}, now: ${now.toISOString()}`
        );
        throw new BadRequestException('It is not possible to cancel a past session');
      }

      booking.status = BookingStatus.CANCELLED;
      slot.status = SlotStatus.FREE;

      await manager.save(booking);
      await manager.save(slot);

      this.logger.log(`Booking canceled: ${bookingId}`);

      const updatedBooking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['slot', 'slot.tutor', 'student'],
      });

      return this.bookingMapper.mapToResponseDto(updatedBooking);
    });
  }
}
