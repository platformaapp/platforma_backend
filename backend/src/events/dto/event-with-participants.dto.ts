export class ParticipantDto {
  id: string;
  name: string;
  avatar: string | null;
  email: string;
  status: string;
  payment_status: string;
  registered_at: string;
}

export class EventWithParticipantsDto {
  id: string;
  title: string;
  description: string;
  type: 'standalone' | 'session_based';
  mentor: {
    id: string;
    name: string;
    avatar: string | null;
    bio: string | null;
  };
  session?: {
    id: string;
    student: {
      id: string;
      name: string;
      avatar: string | null;
    };
    status: string;
  };
  datetime_start: string;
  datetime_end: string;
  duration_minutes: number;
  price: number;
  platform_fee: number;
  mentor_revenue: number;
  max_participants: number;
  registered_count: number;
  status: string;
  cover_url: string | null;
  recording_url: string | null;
  video_room?: {
    id: string;
    url: string;
    moderator_url: string | null;
    provider: string;
  };
  participants: ParticipantDto[];
  current_user_participation?: {
    is_registered: boolean;
    is_paid: boolean;
    status: string;
    payment_status: string;
  };
  can_join: boolean;
  time_to_event: {
    days: number;
    hours: number;
    minutes: number;
    text: string;
  } | null;
}
