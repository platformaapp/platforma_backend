import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';

/**
 * Публичное (без авторизации) чтение настроек сайта, которые редактируются
 * из админки — навигация/баннер/партнёры/рубрикатор. Отдельно от
 * admin/settings (тот — только для админа).
 */
@ApiTags('Public Settings')
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly adminService: AdminService) {}

  @Get('site')
  @ApiOperation({ summary: 'Get public site settings (nav/banner/partners/topics)' })
  getSiteSettings() {
    return this.adminService.getSiteSettings();
  }
}
