import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../articles/entities/article.entity';
import { Event, EventStatus, EventType } from '../events/entities/event.entity';
import { User } from '../users/user.entity';
import { slugify } from '../utils/slug';

const PUBLIC_ROUTES = ['/', '/events', '/explore', '/journal', '/about-us', '/about', '/contacts', '/privacy', '/offer', '/tutor-offer', '/user-agreement'];
const escapeXml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
// Match frontend public paths, retaining the UUID so renamed content stays reachable.
const readableId = (name: string, id: string) => {
  const slug = slugify(name || '').slice(0, 120).replace(/-+$/, '');
  return `${slug ? slug + '-' : ''}${id}`;
};

@Injectable()
export class SitemapService {
  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async generate(): Promise<string> {
    const site = this.config.get<string>('SITEMAP_SITE_URL', 'https://platformaapp.ru').replace(/\/+$/, '');
    const parsed = new URL(site);
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || !!parsed.search || !!parsed.hash || !!parsed.username || !!parsed.password) throw new ServiceUnavailableException('Invalid sitemap site URL');
    const [articles, events, mentors] = await Promise.all([
      this.articles.find({ where: { status: 'published', noindex: false }, select: ['id', 'slug', 'canonicalUrl', 'updatedAt'] }),
      this.events.createQueryBuilder('event').innerJoin('event.mentor', 'mentor')
        .select(['event.id', 'event.title', 'event.updatedAt'])
        .where('event.status IN (:...statuses)', { statuses: [EventStatus.SCHEDULED, EventStatus.ACTIVE, EventStatus.ENDED] })
        .andWhere('event.type = :type', { type: EventType.STANDALONE })
        .andWhere('event.isBlocked = false').andWhere('mentor.isBlocked = false').andWhere('mentor.deletedAt IS NULL').getMany(),
      this.users.createQueryBuilder('user')
        .innerJoin('tutor_applications', 'application', 'application.user_id = user.id AND application.status = :status', { status: 'approved' })
        .select(['user.id', 'user.fullName', 'user.updatedAt'])
        .where('user.isBlocked = false').andWhere('user.deletedAt IS NULL').getMany(),
    ]);
    const urls = new Map<string, Date | undefined>(PUBLIC_ROUTES.map(route => [site + route, undefined]));
    for (const article of articles) {
      const url = `${site}/journal/${article.slug}`;
      if (article.slug && (!article.canonicalUrl || article.canonicalUrl === url)) urls.set(url, article.updatedAt);
    }
    for (const event of events) urls.set(`${site}/events/${readableId(event.title, event.id)}`, event.updatedAt);
    for (const mentor of mentors) urls.set(`${site}/explore/${readableId(mentor.fullName, mentor.id)}`, mentor.updatedAt);
    if (urls.size > 50000) throw new ServiceUnavailableException('Sitemap requires splitting into multiple files');
    const entries = [...urls].map(([url, date]) => `<url><loc>${escapeXml(url)}</loc>${date ? `<lastmod>${date.toISOString()}</lastmod>` : ''}</url>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  }
}
