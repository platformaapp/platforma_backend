import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminModerateEventDto } from './dto/moderate-event.dto';
import { ConfigService } from '@nestjs/config';

const UPLOADS_DIR = '/app/uploads';
mkdirSync(UPLOADS_DIR, { recursive: true });

@ApiTags('Admin Events')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminJwtGuard)
@Controller('admin/events')
export class AdminEventsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}

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

  @Get(':id')
  @ApiOperation({ summary: 'Get full event data by ID' })
  getEvent(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getEventById(id);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block an event' })
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

  @Post(':id/upload-cover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload cover image for event moderation (returns url)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) {
          cb(new BadRequestException('Разрешены только изображения (jpeg, png, gif, webp)'), false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  uploadCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://platformaapp.ru');
    return { url: `${frontendUrl}/api/uploads/${file.filename}` };
  }

  @Patch(':id/moderate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit event and notify tutor. After upload-cover, pass the returned url in coverUrl.' })
  async moderateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminModerateEventDto
  ) {
    const event = await this.adminService.moderateEvent(id, dto);
    return { success: true, message: 'Событие обновлено, наставник уведомлён', eventId: event.id };
  }
}
