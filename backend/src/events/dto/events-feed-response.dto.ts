export class TimeToEventDto {
  days: number;
  hours: number;
  minutes: number;
}

export class MentorDto {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export class EventFeedItemDto {
  id: string;
  title: string;
  description: string;
  datetimeStart: string;
  timeToEvent: TimeToEventDto | null;
  durationMinutes: number;
  coverUrl: string | null;
  price: number;
  mentor: MentorDto;
  isRegistered?: boolean;
  isPaid?: boolean;
  status: string;
}

export class PaginationDto {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

export class EventsFeedResponseDto {
  items: EventFeedItemDto[];
  pagination: PaginationDto;
}
