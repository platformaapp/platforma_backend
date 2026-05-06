import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';

@ApiTags('Admin Events')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminJwtGuard)
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all events with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'per_page', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  getEvents(
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('search') search?: string
  ) {
    return this.adminService.getEvents(Number(page ?? 1), Number(perPage ?? 20), search);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block an event (hides it from the feed and prevents registration)' })
  async blockEvent(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.blockEvent(id);
    return { message: 'Событие заблокировано' };
  }

  @Post(':id/unblock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock an event' })
  async unblockEvent(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.unblockEvent(id);
    return { message: 'Событие разблокировано' };
  }
}
