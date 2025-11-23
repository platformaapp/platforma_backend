import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { VideoRoom } from './video-room.entity';
import { UserEvent } from './user-event.entity';
import { Slot } from '../../slots/entities/slot.entity';

export enum EventStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => User, (user) => user.mentoredEvents)
  @JoinColumn({ name: 'mentor_id' })
  mentor: User;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @ManyToOne(() => Slot, (slot) => slot.events, { nullable: true })
  @JoinColumn({ name: 'slot_id' })
  slot: Slot;

  @Column({ name: 'slot_id', nullable: true })
  slotId: string;

  @Column({ type: 'timestamp', name: 'datetime_start' })
  datetimeStart: Date;

  @Column({ type: 'timestamp', name: 'datetime_end' })
  datetimeEnd: Date;

  @Column({ type: 'int', name: 'duration_minutes' })
  durationMinutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'platform_fee', default: 0 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'mentor_revenue', default: 0 })
  mentorRevenue: number;

  @Column({ type: 'int', name: 'max_participants', default: 30 })
  maxParticipants: number;

  @OneToOne(() => VideoRoom, (videoRoom) => videoRoom.event, {
    cascade: true,
    eager: true,
  })
  videoRoom: VideoRoom;

  @Column({ name: 'video_room_id', nullable: true })
  videoRoomId: string;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ type: 'varchar', nullable: true, name: 'recording_url' })
  recordingUrl: string;

  @OneToMany(() => UserEvent, (userEvent) => userEvent.event)
  userEvents: UserEvent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  registeredCount?: number;
}
