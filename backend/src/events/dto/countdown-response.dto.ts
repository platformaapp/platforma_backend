export class CountdownResponseDto {
  countdown: string;
  seconds_remaining?: number;
  status?: 'upcoming' | 'active' | 'ended' | 'cancelled';
}
