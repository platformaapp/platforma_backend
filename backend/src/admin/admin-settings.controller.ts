import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';

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
}
