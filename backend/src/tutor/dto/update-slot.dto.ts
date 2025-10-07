import { PartialType } from '@nestjs/mapped-types';
import { CreateSlotDto } from './create-slot.dto';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { SlotStatus } from 'src/slots/entities/slot.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSlotDto extends PartialType(CreateSlotDto) {
  @ApiProperty({ enum: SlotStatus, required: false })
  @IsEnum(SlotStatus)
  @IsOptional()
  status?: SlotStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format',
  })
  time?: string;
}
