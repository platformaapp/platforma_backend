import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { SiteSettingsDto } from './dto/site-settings.dto';

class SetCommissionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate: number;
}

@ApiTags('Admin Settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminJwtGuard)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Get all platform settings' })
  getSettings() {
    return this.adminService.getPlatformCommission();
  }

  @Get('commission')
  @ApiOperation({ summary: 'Get platform commission rate (%)' })
  getPlatformCommission() {
    return this.adminService.getPlatformCommission();
  }

  @Patch('commission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set platform commission rate (%)' })
  async setPlatformCommission(@Body() dto: SetCommissionDto) {
    await this.adminService.setPlatformCommission(dto.commissionRate);
    return { message: 'Комиссия обновлена' };
  }

  @Get('site')
  @ApiOperation({ summary: 'Get site settings (nav/banner/partners/topics)' })
  getSiteSettings() {
    return this.adminService.getSiteSettings();
  }

  @Put('site')
  @ApiOperation({ summary: 'Update site settings (nav/banner/partners/topics)' })
  setSiteSettings(@Body() dto: SiteSettingsDto) {
    return this.adminService.setSiteSettings(dto);
  }
}
