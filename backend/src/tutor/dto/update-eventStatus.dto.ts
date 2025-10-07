import { IsEnum } from 'class-validator';
import { EventStatus } from 'src/events/entities/event.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEventStatusDto {
  @ApiProperty({ enum: EventStatus })
  @IsEnum(EventStatus)
  status: EventStatus;
}
