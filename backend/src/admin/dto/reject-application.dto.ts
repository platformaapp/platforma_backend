import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectApplicationDto {
  @ApiPropertyOptional({ example: 'Недостаточно опыта' })
  @IsOptional()
  @IsString()
  reason?: string;
}
