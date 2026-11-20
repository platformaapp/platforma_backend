import { IsEnum, IsInt, IsOptional, IsUUID, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EventType } from '../entities/event.entity';

export class EventsFeedQueryDto {
  @IsOptional()
  @IsUUID()
  mentor_id?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  include_past: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;
}
