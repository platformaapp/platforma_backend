import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const UPLOADS_DIR = '/app/uploads';

mkdirSync(UPLOADS_DIR, { recursive: true });

@Controller('uploads')
export class UploadsController {
  @Get(':filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response): void {
    if (!filename || filename.includes('..') || /[/\\]/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = join(UPLOADS_DIR, filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }
    res.sendFile(filePath);
  }

  @Post('image')
  @UseGuards(JwtAuthGuard)
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
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }
    return { url: `https://platformaapp.ru/api/uploads/${file.filename}` };
  }
}
