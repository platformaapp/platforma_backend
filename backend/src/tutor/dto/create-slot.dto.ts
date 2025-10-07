import { IsDateString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSlotDto {
  @ApiProperty({ example: '2024-01-15' })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ example: '14:30' })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Time must be in HH:mm format' })
  time: string;
}
