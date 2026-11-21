import { Controller, Get, Header } from '@nestjs/common';
import { SitemapService } from './sitemap.service';

/** Public API route: never handled by the Expo/SPA router. */
@Controller('seo')
export class SitemapController {
  constructor(private readonly sitemap: SitemapService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  getSitemap(): Promise<string> {
    return this.sitemap.generate();
  }
}
