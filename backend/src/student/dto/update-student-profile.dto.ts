import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateStudentProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string;

  // 0, не 1 — та же причина, что в tutor/dto/update-profile.dto.ts: фронтенд
  // всегда шлёт telegram при сохранении профиля, пустая строка — "не указан".
  @ApiPropertyOptional({ description: 'Telegram username without @' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  telegram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: false })
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;
}
