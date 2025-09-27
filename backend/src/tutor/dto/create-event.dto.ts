import { IsUUID, IsOptional, IsEnum, IsString } from 'class-validator';
import { EventStatus } from 'src/events/entities/event.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEventDto {
  @IsUUID()
  slotId: string;

  @IsUUID()
  studentId: string;

  @ApiProperty({
    enum: EventStatus,
    default: EventStatus.PLANNED,
    required: false,
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
