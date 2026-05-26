import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Slot, SlotStatus } from '../slots/entities/slot.entity';
import { User } from '../users/user.entity';
import { BookingDetails } from 'src/utils/types';
import { BookingMapper } from 'src/mapper/booking.mapper';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { TutorApplication } from '../admin/entities/tutor-application.entity';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(TutorApplication)
    private readonly tutorApplicationRepository: Repository<TutorApplication>,

    private readonly dataSource: DataSource,
    private readonly bookingMapper: BookingMapper,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService
  ) {}

  async createBooking(
    studentId: string,
    slotId: string,
    paymentMethodId?: string
  ): Promise<BookingDetails> {
    this.logger.log(`Creating a booking: studentId=${studentId}, slotId=${slotId}`);

    // --- DB transaction: booking + session only, no external calls ---
    const { savedBooking, slot, student, savedSession, isFree } =
      await this.dataSource.transaction(async (manager) => {
        const slot = await manager.findOne(Slot, {
          where: { id: slotId },
          relations: ['tutor'],
        });

        if (!slot) throw new NotFoundException('Slot not found');

        if (slot.status !== SlotStatus.FREE)
          throw new ConflictException('The slot is already taken');

        if (slot.tutor.id === studentId)
          throw new BadRequestException('You cannot book your own slot');

        const tutorApplication = await this.tutorApplicationRepository.findOne({
          where: { userId: slot.tutor.id },
          order: { createdAt: 'DESC' },
        });

        if (!tutorApplication || tutorApplication.status !== 'approved')
          throw new ForbiddenException('Этот наставник ещё не прошёл верификацию');

        const slotDateTime = new Date(`${slot.date}T${slot.time}`);
        if (slotDateTime < new Date())
          throw new BadRequestException('You cannot reserve a past slot.');

        const student = await manager.findOne(User, { where: { id: studentId } });
        if (!student || !student.roles.includes('student'))
          throw new NotFoundException('Student not found or user has invalid role');

        const existingBooking = await manager.findOne(Booking, { where: { slotId } });
        if (existingBooking) throw new ConflictException('This slot is already booked');

        slot.status = SlotStatus.BOOKED;
        await manager.save(slot);

        const savedBooking = await manager.save(
          manager.create(Booking, {
            slotId: slot.id,
            tutorId: slot.tutor.id,
            studentId: student.id,
            status: BookingStatus.PENDING,
          })
        );

        const slotDt = new Date(`${slot.date}T${slot.time}`);
        const savedSession = await manager.save(
          manager.create(Session, {
            tutorId: slot.tutor.id,
            studentId,
            startTime: slotDt,
            endTime: new Date(slotDt.getTime() + 60 * 60000),
            price: slot.price,
            status: SessionStatus.PLANNED,
          })
        );

        const isFree = Number(slot.price) <= 0;
        if (isFree) {
          await manager.save(
            manager.create(Payment, {
              userId: studentId,
              tutorId: slot.tutor.id,
              sessionId: savedSession.id,
              amount: 0,
              currency: 'RUB',
              status: PaymentStatus.SUCCESS,
              paidAt: new Date(),
            })
          );
          await manager.update(Session, savedSession.id, { status: SessionStatus.CONFIRMED });
          this.logger.log(`Free session ${savedSession.id} confirmed automatically`);
        }

        this.logger.log(`Booking ${savedBooking.id} and session ${savedSession.id} created`);
        return { savedBooking, slot, student, savedSession, isFree };
      });

    // --- Payment initiation (outside transaction to avoid holding DB connection) ---
    let paymentInfo: BookingDetails['paymentInfo'];

    if (isFree) {
      paymentInfo = { payment_status: 'not_required' };
    } else {
      try {
        const paymentResult = await this.paymentsService.createSessionPayment(
          studentId,
          savedSession.id,
          paymentMethodId
        );
        paymentInfo = {
          payment_status: paymentResult.status,
          confirmation_url: paymentResult.redirectUrl,
          yookassa_payment_id: paymentResult.yookassaPaymentId,
        };
        this.logger.log(`Payment initiated for session ${savedSession.id}: ${paymentResult.status}`);
      } catch (err) {
        this.logger.error(`Payment initiation failed for session ${savedSession.id}: ${(err as Error).message}`);
        paymentInfo = { payment_status: 'failed' };
      }
    }

    return {
      ...this.bookingMapper.mapToBookingWithSession(
        savedBooking,
        slot,
        student,
        slot.tutor,
        savedSession
      ),
      paymentInfo,
    };
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

  async getStudentProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      telegram: user.telegram,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      roles: user.roles,
      createdAt: user.createdAt,
    };
  }

  async updateStudentProfile(
    userId: string,
    dto: UpdateStudentProfileDto
  ): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Email already in use');
    }

    if (dto.phone && dto.phone !== user.phone) {
      const existing = await this.userRepository.findOne({ where: { phone: dto.phone } });
      if (existing) throw new ConflictException('Phone already in use');
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.telegram !== undefined) user.telegram = dto.telegram || null;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) user.bio = dto.bio;

    const saved = await this.userRepository.save(user);

    this.logger.log(`Student profile updated: ${userId}`);

    return {
      id: saved.id,
      fullName: saved.fullName,
      email: saved.email,
      phone: saved.phone,
      telegram: saved.telegram,
      avatarUrl: saved.avatarUrl,
      bio: saved.bio,
      roles: saved.roles,
      createdAt: saved.createdAt,
    };
  }

  async getBookingJoinUrl(studentId: string, bookingId: string): Promise<{ join_url: string }> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['slot'],
    });

    if (!booking) throw new NotFoundException('Бронирование не найдено');
    if (booking.studentId !== studentId) throw new ForbiddenException('Нет доступа к этому бронированию');
    if (booking.status === BookingStatus.CANCELLED) throw new BadRequestException('Бронирование отменено');

    const base = this.configService.get<string>('JITSI_BASE_URL', 'https://meet.jit.si');
    const roomName = `platforma-${bookingId.replace(/-/g, '')}`;
    return { join_url: `${base}/${roomName}` };
  }

  async getTutorAvailableSlots(
    tutorId: string
  ): Promise<{ id: string; date: string; time: string; status: SlotStatus; price: number }[]> {
    const tutor = await this.userRepository.findOne({ where: { id: tutorId } });
    if (!tutor) throw new NotFoundException('Тьютор не найден');

    const today = new Date().toISOString().split('T')[0];

    const slots = await this.dataSource.getRepository(Slot).find({
      where: {
        tutor: { id: tutorId },
        date: MoreThanOrEqual(today),
      },
      order: { date: 'ASC', time: 'ASC' },
    });

    return slots.map((slot) => ({
      id: slot.id,
      date: slot.date,
      time: slot.time.substring(0, 5),
      status: slot.status,
      price: Number(slot.price),
    }));
  }
}
