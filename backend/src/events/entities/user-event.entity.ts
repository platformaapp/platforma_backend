import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Event } from './event.entity';
import { Session } from 'src/session/entities/session.entity';

export enum ParticipationStatus {
  REGISTERED = 'registered',
  CANCELLED = 'cancelled',
  ATTENDED = 'attended',
  PENDING = 'pending',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

@Entity('user_events')
@Index(['userId', 'eventId'], { unique: true })
export class UserEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.userEvents)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Event, (event) => event.userEvents)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Session, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column({
    type: 'enum',
    enum: ParticipationStatus,
    default: ParticipationStatus.REGISTERED,
  })
  status: ParticipationStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    name: 'payment_status',
  })
  paymentStatus: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
