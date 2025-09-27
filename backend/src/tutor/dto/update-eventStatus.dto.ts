import { IsEnum } from 'class-validator';
import { EventStatus } from 'src/events/entities/event.entity';

export class UpdateEventStatusDto {
  @IsEnum(EventStatus)
  status: EventStatus;
}
