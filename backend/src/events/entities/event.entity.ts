import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/user.entity';
import { Slot } from '../../slots/entities/slot.entity';

export enum EventStatus {
  PLANNED = 'planned',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Slot, (slot) => slot.events, { eager: true })
  @JoinColumn({ name: 'slot_id' })
  slot: Slot;

  @ManyToOne(() => User, (user) => user.studentBookings)
  student: User;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.PLANNED,
  })
  status: EventStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
