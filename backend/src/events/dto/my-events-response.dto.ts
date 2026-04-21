export class TimeLeftDto {
  days: number;
  hours: number;
  minutes: number;
  text: string;
}

export class UserInfoDto {
  id: string;
  name: string;
  avatar: string | null;
}

export class MyEventItemDto {
  id: string;
  title: string;
  type: 'standalone' | 'session_based';
  teacher: UserInfoDto;
  student?: UserInfoDto;
  start_at: string;
  price: number;
  time_left: TimeLeftDto | null;
  status: string;
}

export class MyEventsPaginationDto {
  page: number;
  per_page: number;
  total: number;
}

export class MyEventsResponseDto {
  data: MyEventItemDto[];
  pagination: MyEventsPaginationDto;
}
