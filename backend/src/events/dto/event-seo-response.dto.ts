export class EventSeoResponseDto {
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  noindex: boolean;
  nofollow: boolean;
  published_at: string;
  updated_at: string;
  excerpt: string | null;
  cover_alt: string | null;
  slug_aliases: string[];
}
