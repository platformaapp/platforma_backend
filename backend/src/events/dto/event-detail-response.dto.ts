import { EventStatus } from '../entities/event.entity';

export class MentorInfoDto {
  id: string;
  name: string;
}

export class VideoRoomInfoDto {
  url: string | null;
}

export class EventDetailResponseDto {
  id: string;
  title: string;
  mentor: MentorInfoDto;
  datetime_start: string;
  countdown: string;
  max_participants: number;
  registered_count: number;
  video_room: VideoRoomInfoDto;
  status: EventStatus;
  description?: string;
  price?: number;
  platform_fee?: number;
  mentor_revenue?: number;
  duration_minutes?: number;
  datetime_end?: string;
}
