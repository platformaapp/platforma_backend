import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';

class SetTutorCommissionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate: number | null;
}

@ApiTags('Admin Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminJwtGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all users with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'per_page', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  getUsers(
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('role') role?: string,
    @Query('search') search?: string
  ) {
    return this.adminService.getUsers(Number(page ?? 1), Number(perPage ?? 20), role, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full user data by ID' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.blockUser(id);
    return { message: 'Пользователь заблокирован' };
  }

  @Post(':id/unblock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock a user' })
  async unblockUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.unblockUser(id);
    return { message: 'Пользователь разблокирован' };
  }

  @Patch(':id/commission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set individual commission rate for a tutor (null = use platform default)' })
  async setTutorCommission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTutorCommissionDto
  ) {
    await this.adminService.setTutorCommission(id, dto.commissionRate);
    return { message: 'Комиссия наставника обновлена' };
  }
}
