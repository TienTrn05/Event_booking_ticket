import { ui } from '../../../shared/styles/classes';
import { SectionEmblem } from '../../../shared/ui/SectionEmblem';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { articles } from '../data/articles';
import Badge from '../../../shared/ui/Badge';

export default function BlogPreview() {
  return (
    <section id="blog" className={ui('home-chapter chapter-blog py-14 lg:py-20 bg-white')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <SectionEmblem kind="blog" />
            <h2
              data-reveal="heading"
              className={ui(
                'text-2xl lg:text-3xl font-extrabold text-ink-900 tracking-tight mt-1.5',
              )}
            >
              Blog & Insights
            </h2>
          </div>
          <Link
            to="/blog"
            className="hidden h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-100 sm:inline-flex"
          >
            All articles
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className={ui('grid grid-cols-1 sm:grid-cols-3 gap-5')}>
          {Object.entries(articles).map(([id, post]) => (
            <Link
              data-reveal
              key={id}
              to={`/blog/${id}`}
              className={ui(
                'group bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 cursor-pointer',
              )}
            >
              <div className={ui('relative aspect-[16/10] overflow-hidden bg-ink-100')}>
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className={ui('absolute top-3 left-3')}>
                  <Badge variant="neutral">{post.category}</Badge>
                </div>
              </div>
              <div className={ui('p-5')}>
                <h3
                  className={ui(
                    'text-base font-bold text-ink-900 leading-snug mb-2 line-clamp-2 group-hover:text-primary-700 transition-colors',
                  )}
                >
                  {post.title}
                </h3>
                <p className={ui('text-sm text-ink-500 leading-relaxed mb-4 line-clamp-2')}>
                  {post.paragraphs[0]}
                </p>
                <div className={ui('flex items-center gap-4 text-xs text-ink-400')}>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Calendar size={13} />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock size={13} />
                    {post.readTime}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
