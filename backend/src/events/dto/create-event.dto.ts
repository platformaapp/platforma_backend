import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  IsUrl,
  Min,
  Max,
  IsEnum,
  IsUUID,
  Length,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EventCategory, EventType } from '../entities/event.entity';
import { normalizeTags } from '../../utils/tags';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  datetime_start: string;

  @IsDateString()
  datetime_end: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  max_participants?: number;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @IsOptional()
  @IsEnum(EventCategory)
  category?: EventCategory;

  // Не IsIn(TOPICS) — список тем теперь редактируется из админки
  // (platform_settings), это больше не статичный enum на билд-тайме.
  @IsOptional()
  @IsString()
  @Length(1, 100)
  topic?: string;

  /** Хэштеги (без "#", см. utils/tags.ts) — рядом с названием на сайте. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => normalizeTags(value))
  tags?: string[];
}
