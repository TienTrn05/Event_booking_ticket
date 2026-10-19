import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { EmptyState, ErrorState, Skeleton } from '../../../shared/ui/Page';
import { articleSchema } from '../../catalog/api/catalog.api';
import { useCatalogResource } from '../../catalog/hooks/useCatalogResource';
import { CatalogCollectionPage } from '../../catalog/pages/CatalogCollectionPage';

export function BlogPage() {
  const { articleId } = useParams();
  const { t } = useLocale();
  const detail = useCatalogResource(
    articleId ? `/articles/${encodeURIComponent(articleId)}` : null,
    articleSchema,
  );
  const article = detail.data;
  if (!articleId) return <CatalogCollectionPage kind="articles" />;
  if (!article)
    return (
      <main id="main" className="mx-auto min-h-[55vh] max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8">
        {detail.loading ? (
          <Skeleton className="h-96" />
        ) : detail.error ? (
          <ErrorState onRetry={detail.retry} />
        ) : (
          <EmptyState
            title={t('Không tìm thấy bài viết', 'Article unavailable')}
            action={
              <Link to="/blog" className="font-semibold text-accent">
                {t('Về Blog', 'Back to the journal')}
              </Link>
            }
          />
        )}
      </main>
    );
  return (
    <main id="main" className="mx-auto min-h-[55vh] max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label={t('Đường dẫn', 'Breadcrumb')} className="mb-6 flex gap-2 text-sm text-muted">
        <Link to="/" className="hover:text-accent">
          {t('Trang chủ', 'Home')}
        </Link>
        <span>/</span>
        <Link to="/blog" className="hover:text-accent">
          Blog
        </Link>
      </nav>

      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-accent">{article.category}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-5 flex items-center gap-2 text-sm text-muted">
          <CalendarDays size={16} />
          {article.date}
          {article.readTime && ` · ${article.readTime}`}
        </p>
        {article.image && (
          <img
            src={article.image}
            alt=""
            width={960}
            height={600}
            className="mt-8 aspect-[16/10] w-full rounded-2xl object-cover"
          />
        )}
        <div className="mt-8 space-y-6 text-base leading-8 text-muted">
          {article.paragraphs.map((paragraph, index) => (
            <p className="whitespace-pre-line" key={index}>
              {paragraph}
            </p>
          ))}
        </div>
        <Link
          to="/blog"
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
        >
          <ArrowLeft size={16} />
          {t('Các bài viết khác', 'More stories')}
        </Link>
      </article>
    </main>
  );
}
