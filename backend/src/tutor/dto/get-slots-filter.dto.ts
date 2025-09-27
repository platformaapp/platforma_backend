import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SlotStatus } from 'src/slots/entities/slot.entity';

export class GetSlotsFilterDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(SlotStatus)
  status?: SlotStatus;
}
