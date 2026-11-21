import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../articles/entities/article.entity';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/user.entity';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Event, User])],
  controllers: [SitemapController],
  providers: [SitemapService],
})
export class SeoModule {}
