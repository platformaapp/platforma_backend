import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { Event } from 'src/events/entities/event.entity';
import { FindManyOptions, In, Not, Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Slot, SlotStatus } from 'src/slots/entities/slot.entity';
import { GetSlotsFilterDto } from './dto/get-slots-filter.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { isUUID } from 'class-validator';
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { BookingDetails, PaymentsSummary } from 'src/utils/types';
import { Booking, BookingStatus } from 'src/student/entities/booking.entity';
import { BookingMapper } from 'src/mapper/booking.mapper';

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,

    @InjectRepository(Slot)
    private slotsRepository: Repository<Slot>,

    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,

    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,

    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly bookingMapper: BookingMapper
  ) {}

  async getTutorProfile(userId: string): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'phone',
        'fullName',
        'role',
        'avatarUrl',
        'bio',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async updateTutorProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto
  ): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');

    if (updateProfileDto.phone && updateProfileDto.phone !== user.phone) {
      const existingUserWithPhone = await this.usersRepository.findOne({
        where: { phone: updateProfileDto.phone },
      });
      if (existingUserWithPhone) throw new ConflictException('Phone number already exists');
    }

    if (updateProfileDto.fullName !== undefined) user.fullName = updateProfileDto.fullName;
    if (updateProfileDto.bio !== undefined) user.bio = updateProfileDto.bio;
    if (updateProfileDto.avatarUrl !== undefined) user.avatarUrl = updateProfileDto.avatarUrl;
    if (updateProfileDto.phone !== undefined) user.phone = updateProfileDto.phone;

    user.updatedAt = new Date();
    const updatedUser = await this.usersRepository.save(user);

    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    void _;
    return userWithoutPassword;
  }

  async getTutorSlots(userId: string, filter: GetSlotsFilterDto): Promise<Slot[]> {
    const query: FindManyOptions<Slot> = {
      where: { tutor: { id: userId } },
      relations: ['tutor'],
      order: { date: 'ASC', time: 'ASC' },
    };

    if (filter.date) {
      query.where = { ...query.where, date: filter.date };
    }

    if (filter.status) {
      query.where = { ...query.where, status: filter.status };
    }

    return await this.slotsRepository.find(query);
  }

  async createSlot(userId: string, createSlotDto: CreateSlotDto): Promise<Slot> {
    const slotDateTime = new Date(`${createSlotDto.date}T${createSlotDto.time}:00Z`);
    if (slotDateTime < new Date()) {
      throw new BadRequestException('Cannot create slot in the past');
    }

    const tutor = await this.usersRepository.findOne({
      where: { id: userId, role: 'tutor' },
    });
    if (!tutor) throw new NotFoundException('Tutor not found');

    const existingSlot = await this.slotsRepository.findOne({
      where: {
        tutor: { id: userId },
        price: createSlotDto.price,
        date: createSlotDto.date,
        time: createSlotDto.time,
      },
    });
    if (existingSlot) throw new ConflictException('Slot already exists at this date and time');

    const slot = this.slotsRepository.create({
      tutor,
      date: createSlotDto.date,
      time: createSlotDto.time,
      price: createSlotDto.price,
      status: SlotStatus.FREE,
    });

    const savedSlot = await this.slotsRepository.save(slot);

    return await this.slotsRepository.findOne({
      where: { id: savedSlot.id },
      relations: ['tutor'],
      select: ['id', 'date', 'time', 'status', 'createdAt', 'updatedAt', 'tutor'],
    });
  }

  async updateSlot(userId: string, slotId: string, updateSlotDto: UpdateSlotDto): Promise<Slot> {
    const slot = await this.slotsRepository.findOne({
      where: { id: slotId },
      relations: ['tutor'],
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    if (slot.tutor.id !== userId) {
      throw new ForbiddenException('You can only update your own slots');
    }

    if (updateSlotDto.date || updateSlotDto.time) {
      const date = updateSlotDto.date || slot.date;
      const time = updateSlotDto.time || slot.time;

      const existingSlot = await this.slotsRepository.findOne({
        where: {
          tutor: { id: userId },
          date: date,
          time: time,
          id: Not(slotId),
        },
      });

      if (existingSlot) {
        throw new ConflictException('Slot already exists at this date and time');
      }
    }

    if (updateSlotDto.date !== undefined) slot.date = updateSlotDto.date;
    if (updateSlotDto.time !== undefined) slot.time = updateSlotDto.time;
    if (updateSlotDto.status !== undefined) slot.status = updateSlotDto.status;

    slot.updatedAt = new Date();

    const updatedSlot = await this.slotsRepository.save(slot);

    return await this.slotsRepository.findOne({
      where: { id: updatedSlot.id },
      relations: ['tutor'],
    });
  }

  async deleteSlot(userId: string, slotId: string): Promise<void> {
    if (!isUUID(slotId)) {
      throw new BadRequestException('Invalid slot ID format');
    }

    const slot = await this.slotsRepository.findOne({
      where: { id: slotId },
      relations: ['tutor'],
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    if (slot.tutor.id !== userId) {
      throw new ForbiddenException('You can only delete your own slots');
    }

    if (slot.status === SlotStatus.BOOKED) {
      throw new ForbiddenException('Cannot delete a booked slot');
    }

    const eventCount = await this.eventsRepository.count({ where: { slot: { id: slotId } } });

    if (eventCount > 0) {
      throw new BadRequestException(
        `Unable to delete slot: ${eventCount} event(s) are bound to it.`
      );
    }

    await this.slotsRepository.remove(slot);
  }

  async deleteSlots(userId: string, slotIds: string[]): Promise<{ deletedCount: number }> {
    if (slotIds.length === 0) {
      throw new BadRequestException('Slot IDs array cannot be empty');
    }
    if (!slotIds || !Array.isArray(slotIds) || slotIds.length === 0) {
      throw new BadRequestException('Slot IDs array is required');
    }

    const uniqueIds = [...new Set(slotIds)];
    if (uniqueIds.length !== slotIds.length) {
      throw new BadRequestException('Duplicate slot IDs are not allowed');
    }

    const invalidIds = slotIds.filter((id) => !isUUID(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid slot ID format: ${invalidIds.join(', ')}`);
    }

    const slots = await this.slotsRepository.find({
      where: {
        id: In(slotIds),
        tutor: { id: userId },
      },
      relations: ['tutor'],
    });

    if (slots.length === 0) {
      throw new NotFoundException('No slots found for deletion');
    }

    const foundIds = slots.map((slot) => slot.id);
    const notFoundIds = slotIds.filter((id) => !foundIds.includes(id));

    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Some slots not found or not owned by you: ${notFoundIds.join(', ')}`
      );
    }

    const bookedSlots = slots.filter((slot) => slot.status === SlotStatus.BOOKED);
    if (bookedSlots.length > 0) {
      const bookedIds = bookedSlots.map((slot) => slot.id);
      throw new ForbiddenException(`Cannot delete booked slots: ${bookedIds.join(', ')}`);
    }

    await this.slotsRepository.remove(slots);
    return { deletedCount: slots.length };
  }

  //Events
  // async getTutorEvents(userId: string): Promise<Event[]> {
  //   return await this.eventsRepository
  //     .createQueryBuilder('event')
  //     .leftJoinAndSelect('event.slot', 'slot')
  //     .leftJoinAndSelect('slot.tutor', 'tutor')
  //     .leftJoinAndSelect('event.student', 'student')
  //     .where('tutor.id = :userId', { userId })
  //     .orderBy('slot.date', 'ASC')
  //     .addOrderBy('slot.time', 'ASC')
  //     .getMany();
  // }

  // async createEvent(userId: string, createEventDto: CreateEventDto): Promise<Event> {
  //   const slot = await this.slotsRepository.findOne({
  //     where: { id: createEventDto.slotId },
  //     relations: ['tutor', 'events'],
  //   });
  //
  //   if (!slot) {
  //     throw new NotFoundException('Slot not found');
  //   }
  //
  //   if (slot.tutor.id !== userId) {
  //     throw new ForbiddenException('You can only create events for your own slots');
  //   }
  //
  //   if (slot.status !== SlotStatus.FREE) {
  //     throw new ConflictException('Slot is not available for booking');
  //   }
  //
  //   if (slot.events && slot.events.length > 0) {
  //     throw new ConflictException('Slot already has an event');
  //   }
  //
  //   const student = await this.usersRepository.findOne({
  //     where: { id: createEventDto.studentId, role: 'student' },
  //   });
  //
  //   if (!student) {
  //     throw new NotFoundException('Student not found');
  //   }
  //
  //   const event = this.eventsRepository.create({
  //     slot: { id: slot.id },
  //     student: { id: student.id },
  //     status: createEventDto.status || EventStatus.PLANNED,
  //     notes: createEventDto.notes || null,
  //   });
  //
  //   const savedEvent = await this.eventsRepository.save(event);
  //
  //   return await this.eventsRepository
  //     .createQueryBuilder('event')
  //     .leftJoinAndSelect('event.slot', 'slot')
  //     .leftJoinAndSelect('slot.tutor', 'tutor')
  //     .leftJoinAndSelect('event.student', 'student')
  //     .where('event.id = :id', { id: savedEvent.id })
  //     .getOne();
  // }

  // async updateEventStatus(userId: string, eventId: string, status: EventStatus) {
  //   if (!Object.values(EventStatus).includes(status)) {
  //     throw new BadRequestException('Invalid event status');
  //   }
  //
  //   const event = await this.eventsRepository.findOne({
  //     where: { id: eventId },
  //     relations: ['slot', 'slot.tutor', 'student'],
  //   });
  //
  //   if (!event) throw new NotFoundException('Event not found');
  //
  //   if (event.slot.tutor.id !== userId) {
  //     throw new ForbiddenException('You can only update your own events');
  //   }
  //
  //   event.status = status;
  //   await this.eventsRepository.save(event);
  //
  //   return await this.eventsRepository.findOne({
  //     where: { id: event.id },
  //     relations: ['slot', 'slot.tutor', 'student'],
  //   });
  // }

  async getTutorPayments(userId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: {
        tutor: { id: userId },
      },
      order: { createdAt: 'DESC' },
      select: ['id', 'amount', 'currency', 'status', 'createdAt'],
      relations: ['tutor'],
    });
  }

  async getPaymentsSummary(userId: string) {
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const query = this.paymentsRepository
      .createQueryBuilder('payment')
      .select('SUM(CASE WHEN payment.status = :success THEN payment.amount ELSE 0 END)', 'total')
      .addSelect(
        'SUM(CASE WHEN payment.status = :success AND payment.created_at >= :month THEN payment.amount ELSE 0 END)',
        'month'
      )
      .addSelect(
        'SUM(CASE WHEN payment.status = :success AND payment.created_at >= :week THEN payment.amount ELSE 0 END)',
        'week'
      )
      .addSelect('COUNT(CASE WHEN payment.status = :success THEN 1 END)', 'count')
      .where('payment.tutor_Id = :userId', { userId })
      .setParameters({ success: PaymentStatus.SUCCESS, month: startOfMonth, week: startOfWeek });

    const result = await query.getRawOne<PaymentsSummary>();

    return {
      total: parseFloat(result.total) || 0,
      month: parseFloat(result.month) || 0,
      week: parseFloat(result.week) || 0,
      count: parseInt(result.count, 10) || 0,
    };
  }

  async getTutorBookings(tutorId: string): Promise<BookingDetails[]> {
    const bookings = await this.bookingRepository.find({
      where: { tutorId },
      relations: ['slot', 'student'],
      order: { createdAt: 'DESC' },
    });

    return this.bookingMapper.mapToBookingDetailsList(bookings);
  }

  async completeBooking(tutorId: string, bookingId: string): Promise<BookingDetails> {
    this.logger.log(`End of session: tutorId=${tutorId}, bookingId=${bookingId}`);

    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['slot', 'student', 'tutor'],
    });

    if (!booking) {
      this.logger.warn(`Booking not found: ${bookingId}`);
      throw new NotFoundException('Booking not found');
    }

    if (booking.tutorId !== tutorId) {
      this.logger.warn(
        `Attempt to terminate someone else's session: tutorId=${tutorId}, booking.tutorId=${booking.tutorId}`
      );
      throw new ForbiddenException("You can't terminate someone else's session");
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      this.logger.warn(`Invalid status for completion: ${booking.status}`);
      throw new BadRequestException('Only confirmed sessions can be terminated.');
    }

    const slotDateTime = new Date(`${booking.slot.date}T${booking.slot.time}`);
    const now = new Date();

    if (slotDateTime > now) {
      this.logger.warn(
        `Attempt to complete a future session: ${slotDateTime.toISOString()}, now: ${now.toISOString()}`
      );
      throw new BadRequestException('You cannot end a session before it starts.');
    }

    booking.status = BookingStatus.DONE;
    const updatedBooking = await this.bookingRepository.save(booking);

    this.logger.log(`The session has ended.: ${bookingId}`);

    return this.bookingMapper.mapToBookingDetailsList([updatedBooking])[0];
  }
}
