/**
 * Свободные хэштеги (не фиксированный рубрикатор, см. topics.ts) — задаются
 * из админки для статей/событий/наставников, показываются на сайте рядом с
 * именем/названием как "#тег". Хранятся без ведущего "#" (см. tags-колонки
 * в article/event/user entity) — "#" добавляется только при отображении.
 */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().replace(/^#+/, '').trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}
