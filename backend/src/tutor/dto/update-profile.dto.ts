import { IsEmail, IsNumber, IsOptional, IsString, IsUrl, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  shortBio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: false })
  avatarUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string;

  // 0 (не 1) — фронтенд всегда шлёт это поле при любом сохранении профиля
  // (даже если меняли только, скажем, стоимость часа), а не только когда
  // сам телеграм редактируют; пустая строка здесь означает "не указан",
  // а не невалидный ввод.
  @ApiProperty({ required: false, description: 'Telegram username without @' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  telegram?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  groupMeetings?: string;

  // Не IsIn(TOPICS) — список тем теперь редактируется из админки
  // (platform_settings), это больше не статичный enum на билд-тайме.
  @ApiProperty({ required: false, description: 'Рубрикатор — тема специализации наставника' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  specialization?: string;
}
