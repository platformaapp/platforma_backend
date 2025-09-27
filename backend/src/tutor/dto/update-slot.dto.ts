import { PartialType } from '@nestjs/mapped-types';
import { CreateSlotDto } from './create-slot.dto';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { SlotStatus } from 'src/slots/entities/slot.entity';

export class UpdateSlotDto extends PartialType(CreateSlotDto) {
  @IsEnum(SlotStatus)
  @IsOptional()
  status?: SlotStatus;

  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format',
  })
  time?: string;
}
