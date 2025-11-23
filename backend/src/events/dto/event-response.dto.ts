import { EventStatus } from '../entities/event.entity';

export class EventResponseDto {
  id: string;
  title: string;
  description: string;
  datetime_start: string;
  datetime_end: string;
  price: number;
  platform_fee: number;
  mentor_revenue: number;
  max_participants: number;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}
