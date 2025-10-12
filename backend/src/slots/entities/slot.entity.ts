import { User } from 'src/users/user.entity';
import { Event } from 'src/events/entities/event.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { Booking } from 'src/student/entities/booking.entity';

export enum SlotStatus {
  FREE = 'free',
  BOOKED = 'booked',
  CANCELLED = 'cancelled',
}

@Entity('slots')
export class Slot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.tutorSlots, { eager: false })
  @JoinColumn({ name: 'tutor_id' })
  tutor: User;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  time: string;

  @Column({
    type: 'enum',
    enum: SlotStatus,
    default: SlotStatus.FREE,
  })
  status: SlotStatus;

  @OneToMany(() => Event, (event) => event.slot)
  events: Event[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => Booking, (booking) => booking.slot)
  booking: Booking;
}
