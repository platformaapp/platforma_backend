import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  IsUrl,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EventCategory } from '../entities/event.entity';
import { normalizeTags } from '../../utils/tags';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  datetime_start?: string;

  @IsDateString()
  @IsOptional()
  datetime_end?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  max_participants?: number;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @IsOptional()
  @IsEnum(EventCategory)
  category?: EventCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => normalizeTags(value))
  tags?: string[];
}
