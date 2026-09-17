import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { ConfigService } from '@nestjs/config';
import { ArticlesService } from '../articles/articles.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminCreateArticleDto, AdminUpdateArticleDto } from './dto/admin-article.dto';

const UPLOADS_DIR = '/app/uploads';
mkdirSync(UPLOADS_DIR, { recursive: true });

@ApiTags('Admin Articles')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminJwtGuard)
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all articles with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'per_page', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  getArticles(
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('category') category?: string,
    @Query('search') search?: string
  ) {
    return this.articlesService.findAll(Number(page ?? 1), Number(perPage ?? 20), category, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full article data by ID' })
  getArticle(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an article on behalf of the given author' })
  createArticle(@Body() dto: AdminCreateArticleDto) {
    const { author_id, ...rest } = dto;
    return this.articlesService.create(rest, author_id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an article, optionally reassigning its author' })
  updateArticle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateArticleDto) {
    const { author_id, ...rest } = dto;
    return this.articlesService.update(id, rest, author_id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an article' })
  removeArticle(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.remove(id);
  }

  @Post('upload-image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a cover/gallery image for an article (returns url)' })
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
      limits: { fileSize: 2 * 1024 * 1024 },
    })
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://platformaapp.ru');
    return { url: `${frontendUrl}/api/uploads/${file.filename}` };
  }
}
