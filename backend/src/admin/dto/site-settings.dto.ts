import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator';

export class NavItemDto {
  @IsString()
  @Length(1, 50)
  label: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: false })
  iconUrl?: string;
}

export class BannerDto {
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: false })
  imageUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: false })
  linkUrl?: string;
}

export class PartnerDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsUrl({ require_tld: false, require_protocol: false })
  logoUrl: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: false })
  linkUrl?: string;
}

/**
 * Единая настройка сайта, управляемая из админки — навигация (текст/иконки),
 * баннер (картинка + ссылка), партнёры (лого + ссылки) и рубрикатор
 * (список тем). Хранится одной строкой JSON в platform_settings
 * (ключ SITE_SETTINGS_KEY, см. admin.service.ts) — свой отдельный набор
 * таблиц ради этого не заводили.
 */
export class SiteSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => NavItemDto)
  navItems?: NavItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BannerDto)
  banner?: BannerDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PartnerDto)
  partners?: PartnerDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  topics?: string[];
}
