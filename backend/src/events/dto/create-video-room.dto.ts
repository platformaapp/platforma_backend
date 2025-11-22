import { IsEnum, IsUUID } from 'class-validator';
import { VideoProvider } from '../entities/video-room.entity';

export class CreateVideoRoomDto {
  @IsUUID()
  event_id: string;

  @IsEnum(VideoProvider)
  provider: VideoProvider;
}

export class VideoRoomResponseDto {
  url: string;
  provider: VideoProvider;
  expires_at: string;
}
