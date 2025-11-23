import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';

export enum VideoProvider {
  TELEMOST = 'Telemost',
  VIDEOMOST = 'VideoMost',
  VK = 'VK',
  WEBINAR_RU = 'WebinarRu',
  JITSI = 'Jitsi',
  MY_OWN_CONFERENCE = 'MyOwnConference',
}

@Entity('video_rooms')
export class VideoRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: VideoProvider,
    default: VideoProvider.MY_OWN_CONFERENCE,
  })
  provider: VideoProvider;

  @Column({ type: 'varchar' })
  url: string;

  @Column({ type: 'varchar', name: 'external_id' })
  externalId: string;

  @Column({ type: 'varchar', name: 'moderator_url', nullable: true })
  moderatorUrl: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @OneToOne(() => Event, (event) => event.videoRoom)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ name: 'event_id' })
  eventId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'expires_at', nullable: true })
  expiresAt: Date;
}
