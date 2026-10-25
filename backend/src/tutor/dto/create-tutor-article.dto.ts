import { IsOptional, IsString, IsNotEmpty, IsUrl, IsUUID, MaxLength } from 'class-validator';

/**
 * Заявка наставника на статью (POST /tutor/articles, см. TutorController) —
 * облегчённая форма по сравнению с полным редактором админки
 * (admin/journal-detail.tsx): только то, что нужно, чтобы предложить тему.
 * Текст статьи ("content") наставник не пишет — редактор дооформляет
 * материал сам в админке перед публикацией (см. Article.status).
 */
export class CreateTutorArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsUrl()
  cover_url?: string;

  /** "Расскажите коротко о теме вашей статьи" — ложится в Article.excerpt
   *  (тот же текст, что потом показывается в карточках /journal). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string;

  /** Событие для интеграции в текст — то же поле, что и в полном редакторе
   *  (Article.eventId), просто выбирается здесь, а не ищется в админке. */
  @IsOptional()
  @IsUUID()
  event_id?: string;
}
