import { Event } from '../events/entities/event.entity';
import { EventResponseDto } from '../events/dto/event-response.dto';

export function toEventResponseDto(event: Event): EventResponseDto {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    datetime_start: event.datetimeStart.toISOString(),
    datetime_end: event.datetimeEnd.toISOString(),
    price: event.price,
    platform_fee: event.platformFee,
    mentor_revenue: event.mentorRevenue,
    max_participants: event.maxParticipants,
    status: event.status,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt.toISOString(),
  };
}
