import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { normalizeTags } from '../../utils/tags';

export class AdminModerateEventDto {
  @ApiPropertyOptional({ description: 'New cover image URL' })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ description: 'New event title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'New event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Optional comment for the tutor from admin' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Event hashtags (without "#")', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => normalizeTags(value))
  tags?: string[];
}
