import { slugify } from './slug';

export const EVENT_RESERVED_SLUGS = ['feed', 'my'];
// A suffix shaped like a UUID is reserved for legacy event URLs.
export const EVENT_UUID_SUFFIX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function eventSlugBase(title: string): string {
  const base = slugify(title).replace(/-+$/, '') || 'event';
  return EVENT_RESERVED_SLUGS.includes(base) || EVENT_UUID_SUFFIX.test(base) ? `${base}-event` : base;
}
