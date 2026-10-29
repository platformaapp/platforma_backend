import { IsEmail, IsNumber, IsOptional, IsString, IsUrl, Length, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// IsOptional() пропускает проверку только для undefined/null, не для пустой
// строки — без этого Transform'а поле с @Length(1, …) и пустым значением
// '' (например fullName/phone/telegram, которые фронтенд иногда шлёт
// пустыми при частичном обновлении профиля) 400-илось бы "must be longer
// than or equal to 1 characters" даже когда поле реально не менялось. '' →
// undefined ДО валидации — тогда IsOptional() действительно его пропускает.
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 255, { message: 'Имя должно быть от 1 до 255 символов' })
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Укажите корректный email' })
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Описание не должно превышать 1000 символов' })
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Краткое описание не должно превышать 500 символов' })
  shortBio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl(
    { require_tld: false, require_protocol: false },
    { message: 'Некорректная ссылка на фото' }
  )
  avatarUrl?: string;

  @ApiProperty({ required: false })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 20, { message: 'Телефон должен быть от 1 до 20 символов' })
  phone?: string;

  @ApiProperty({ required: false, description: 'Telegram username without @' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Telegram должен быть от 1 до 100 символов' })
  telegram?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Стоимость часа должна быть числом' })
  @Min(0, { message: 'Стоимость часа не может быть отрицательной' })
  hourlyRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Описание групповых встреч не должно превышать 1000 символов' })
  groupMeetings?: string;

  // Не IsIn(TOPICS) — список тем теперь редактируется из админки
  // (platform_settings), это больше не статичный enum на билд-тайме.
  @ApiProperty({ required: false, description: 'Рубрикатор — тема специализации наставника' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Специализация должна быть от 1 до 100 символов' })
  specialization?: string;
}
