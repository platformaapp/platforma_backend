import { eventSlugBase, EVENT_RESERVED_SLUGS, EVENT_UUID_SUFFIX } from './event-slug';

describe('event URL slug generation', () => {
  it('transliterates titles and handles titles without letters', () => {
    expect(eventSlugBase('Разговор о кино')).toBe('razgovor-o-kino');
    expect(eventSlugBase('!!!')).toBe('event');
  });

  it('avoids public API endpoint names', () => {
    for (const reserved of EVENT_RESERVED_SLUGS) {
      expect(eventSlugBase(reserved)).toBe(`${reserved}-event`);
    }
  });

  it('does not confuse generated slugs with legacy UUID links', () => {
    const legacy = 'kino-11111111-1111-4111-8111-111111111111';
    expect(EVENT_UUID_SUFFIX.test(legacy)).toBe(true);
    expect(EVENT_UUID_SUFFIX.test(eventSlugBase(legacy))).toBe(false);
  });
});
