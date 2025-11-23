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

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name', nullable: true })
  fullName: string;

  @Column({ type: 'varchar', length: 20 })
  role: UserRole;

  @Column({ type: 'text', name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

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

  @OneToMany(() => Session, (session) => session.tutor)
  tutorSessions: Session[];

  @OneToMany(() => Session, (session) => session.student)
  studentSessions: Session[];
}
