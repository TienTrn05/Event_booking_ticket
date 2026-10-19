import { BookOpen, CalendarDays } from 'lucide-react';
import { ExpressiveIcon } from '../../../shared/ui/ExpressiveIcon';
import { ViewAllLink } from '../../../shared/ui/ViewAllLink';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { HorizontalRail } from '../../../shared/ui/HorizontalRail';
import { SectionHeader } from '../../../shared/ui/SectionHeader';
export default function BlogPreview() {
  const { catalog } = useCatalog();
  const { t, locale } = useLocale();
  const title = t('Chuyện trước giờ diễn', 'Stories before the show');
  if (!catalog.articles.length) return null;
  return (
    <section id="blog" className="home-section home-stories">
      <div className="home-section-inner">
        <HorizontalRail
          label={title}
          density="story"
          heading={
            <SectionHeader
              title={title}
              compact
              eyebrow={t('Nhật ký Eventix', 'The Eventix journal')}
              icon={<ExpressiveIcon icon={BookOpen} tone="violet" />}
            />
          }
          actions={<ViewAllLink to="/blog" />}
        >
          {catalog.articles.slice(0, 6).map((post) => (
            <Link
              data-reveal
              key={post.id}
              to={`/blog/${post.id}`}
              className="home-card group flex min-h-40 gap-4 rounded-2xl border border-line bg-surface p-4"
            >
              {post.image && (
                <div className="w-[104px] shrink-0 self-stretch overflow-hidden rounded-xl bg-raised">
                  <img
                    src={post.image}
                    alt=""
                    width={208}
                    height={260}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  {post.category}
                </p>
                <h3 className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-foreground">
                  {post.title}
                </h3>
                <p className="mt-auto flex items-center gap-2 pt-3 text-[11px] text-muted">
                  <CalendarDays size={12} />
                  {new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                    dateStyle: 'medium',
                  }).format(new Date(post.publishedAt))}
                </p>
              </div>
            </Link>
          ))}
        </HorizontalRail>
      </div>
    </section>
  );
}
