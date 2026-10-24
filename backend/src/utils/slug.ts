/**
 * Человекочитаемый URL статьи (/journal/<slug> вместо /journal/<uuid>) —
 * критично для SEO: поисковик и пользователь видят по URL, о чём страница,
 * а не случайный идентификатор. slug — ЕДИНСТВЕННЫЙ публичный путь к
 * статье (см. ArticlesController/ArticlesService.findBySlug) — старые
 * ссылки на /journal/<uuid> не поддерживаются намеренно (явное решение, не
 * забытый редирект).
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Транслитерация + lowercase + замена всего не [a-z0-9] на "-", без краевых/повторных дефисов. */
export function slugify(input: string): string {
  const transliterated = input
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join('');
  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
