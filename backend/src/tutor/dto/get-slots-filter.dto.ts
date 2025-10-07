import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SlotStatus } from 'src/slots/entities/slot.entity';
import { ApiProperty } from '@nestjs/swagger';

export class GetSlotsFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ enum: SlotStatus, required: false })
  @IsOptional()
  @IsEnum(SlotStatus)
  status?: SlotStatus;
}
