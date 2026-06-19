import { AuthSession } from 'src/auth/auth.entity';
import { Event } from 'src/events/entities/event.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { Slot } from 'src/slots/entities/slot.entity';
import { Booking } from 'src/student/entities/booking.entity';
import { PaymentMethod } from '../payments/entities/payment-method.entity';
import { Session } from '../session/entities/session.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserEvent } from '../events/entities/user-event.entity';

export type UserRole = 'student' | 'tutor' | 'admin';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, name: 'telegram', nullable: true })
  telegram: string | null;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name', nullable: true })
  fullName: string;

  @Column({ type: 'simple-array', nullable: true })
  roles: UserRole[];

  @Column({ type: 'text', name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 500, name: 'short_bio', nullable: true })
  shortBio: string | null;

  @Column({ type: 'decimal', name: 'hourly_rate', nullable: true, precision: 10, scale: 2 })
  hourlyRate: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  specialization: string | null;

  @Column({ type: 'text', name: 'group_meetings', nullable: true })
  groupMeetings: string | null;

  @Column({ type: 'boolean', name: 'is_blocked', default: false })
  isBlocked: boolean;

  @Column({ type: 'decimal', name: 'commission_rate', nullable: true, precision: 5, scale: 2 })
  commissionRate: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => AuthSession, (session) => session.user, { cascade: true })
  sessions: AuthSession[];

  @OneToMany(() => Slot, (slot) => slot.tutor, { cascade: true })
  tutorSlots: Slot[];

  // @OneToMany(() => Event, (event) => event.student)
  // studentEvents: Event[];

  @OneToMany(() => Event, (event) => event.mentor)
  mentoredEvents: Event[];

  @OneToMany(() => UserEvent, (userEvent) => userEvent.user)
  userEvents: UserEvent[];

  @OneToMany(() => Payment, (payment) => payment.tutor)
  payments: Payment[];

  @OneToMany(() => Booking, (booking) => booking.tutor)
  tutorBookings: Booking[];

  @OneToMany(() => Booking, (booking) => booking.student)
  studentBookings: Booking[];

  @OneToMany(() => PaymentMethod, (paymentMethod) => paymentMethod.user)
  paymentMethods: PaymentMethod[];

  @Column({ name: 'default_payment_method_id', nullable: true })
  defaultPaymentMethodId: string | null;

  @Column({ name: 'payout_method', nullable: true, type: 'varchar', length: 20 })
  payoutMethod: 'bank_card' | 'sbp' | null;

  @Column({ name: 'payout_destination', nullable: true, type: 'varchar', length: 255 })
  payoutDestination: string | null;

  @Column({ name: 'payout_bank_id', nullable: true, type: 'varchar', length: 255 })
  payoutBankId: string | null;

  @OneToMany(() => Session, (session) => session.tutor)
  tutorSessions: Session[];

  @OneToMany(() => Session, (session) => session.student)
  studentSessions: Session[];
}
