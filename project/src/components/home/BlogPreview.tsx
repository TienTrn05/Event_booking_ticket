import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { blogPosts } from '@/data/mockData';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

export default function BlogPreview() {
  return (
    <section className="py-14 lg:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
              Insights & Stories
            </span>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-ink-900 tracking-tight mt-1.5">
              From the Blog
            </h2>
          </div>
          <Button variant="ghost" size="sm" className="hidden sm:flex">
            All articles
            <ArrowRight size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {blogPosts.map((post) => (
            <article
              key={post.id}
              className="group bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 cursor-pointer"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="neutral">{post.category}</Badge>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-ink-900 leading-snug mb-2 line-clamp-2 group-hover:text-primary-700 transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-ink-500 leading-relaxed mb-4 line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-4 text-xs text-ink-400">
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
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
