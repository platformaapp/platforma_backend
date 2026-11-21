import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { eventSlugBase } from '../utils/event-slug';

export async function uniqueEventSlug(repository: Repository<Event>, title: string): Promise<string> {
  const base = eventSlugBase(title);
  for (let number = 1; ; number++) {
    const slug = number === 1 ? base : `${base}-${number}`;
    const exists = await repository.createQueryBuilder('event')
      .where('event.slug = :slug OR :slug = ANY(event.slugAliases)', { slug }).getExists();
    if (!exists) return slug;
  }
}

export function eventSeo(event: Event) {
  return {
    slug: event.slug, slug_aliases: event.slugAliases ?? [],
    meta_title: event.metaTitle, meta_description: event.metaDescription,
    og_image: event.ogImage, og_title: event.ogTitle, og_description: event.ogDescription,
    canonical_url: event.canonicalUrl, noindex: event.noindex, nofollow: event.nofollow,
    published_at: (event.publishedAt ?? event.createdAt)?.toISOString(),
    updated_at: event.updatedAt?.toISOString(), excerpt: event.excerpt, cover_alt: event.coverAlt,
  };
}
