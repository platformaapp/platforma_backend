import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, Length } from 'class-validator';
import { Transform } from 'class-transformer';

// IsOptional() пропускает проверку только для undefined/null, не для
// пустой строки — без этого Transform'а поле с @Length(1, …) и пустым
// значением '' 400-илось бы, даже когда поле реально не менялось (см. тот
// же приём в tutor/dto/update-profile.dto.ts). '' → undefined ДО
// валидации — тогда IsOptional() его действительно пропускает.
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class UpdateStudentProfileDto {
  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 255, { message: 'Имя должно быть от 1 до 255 символов' })
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Укажите корректный email' })
  email?: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 20, { message: 'Телефон должен быть от 1 до 20 символов' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Telegram username without @' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Telegram должен быть от 1 до 100 символов' })
  telegram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(
    { require_tld: false, require_protocol: false },
    { message: 'Некорректная ссылка на фото' }
  )
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Описание не должно превышать 1000 символов' })
  bio?: string;
}
