import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({
    status: 200,
    schema: { example: { token: 'eyJ...' } },
  })
  @ApiResponse({
    status: 401,
    schema: { example: { message: 'Неверный логин или пароль' } },
  })
  async login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }
}
