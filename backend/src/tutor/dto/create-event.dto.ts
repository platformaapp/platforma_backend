import { IsUUID, IsOptional, IsEnum, IsString } from 'class-validator';
import { EventStatus } from 'src/events/entities/event.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty()
  @IsUUID()
  slotId: string;

  @ApiProperty()
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
