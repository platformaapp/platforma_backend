import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Slot } from '../../slots/entities/slot.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  DONE = 'done',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Slot, (slot) => slot.booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'slot_id' })
  slot: Slot;

  @Column({ name: 'slot_id' })
  slotId: string;

  @ManyToOne(() => User, (user) => user.tutorBookings)
  @JoinColumn({ name: 'tutor_id' })
  tutor: User;

  @Column({ name: 'tutor_id' })
  tutorId: string;

  @ManyToOne(() => User, (user) => user.studentBookings)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
