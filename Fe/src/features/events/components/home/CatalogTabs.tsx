import { ui } from '../../../../shared/styles/classes';
import { scrollToElement } from '../../../../shared/motion/scroll';
import type { EventCategory } from '../../types/index';

const tagFilters: ReadonlyArray<{ label: string; category: EventCategory }> = [
  { label: 'Nhạc sống', category: 'Music' },
  { label: 'Thể thao', category: 'Sports' },
  { label: 'Sân khấu & Nghệ thuật', category: 'Arts' },
  { label: 'Hội thảo & Workshop', category: 'Workshops' },
  { label: 'Tham quan & Trải nghiệm', category: 'Festivals' },
  { label: 'Khác', category: 'Technology' },
];

export default function CatalogTabs({
  category,
  onCategoryChange,
}: {
  category: EventCategory | 'All';
  onCategoryChange: (category: EventCategory) => void;
}) {
  const selectCategory = (nextCategory: EventCategory) => {
    onCategoryChange(nextCategory);
    const results = document.getElementById('discover');
    if (results) scrollToElement(results);
  };

  return (
    <section
      id="categories"
      aria-label="Lọc sự kiện theo thể loại"
      className={ui('relative z-30 border-b border-ink-100 bg-white !animate-reveal-up')}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={ui('flex items-center gap-2 overflow-x-auto no-scrollbar py-3')}>
          {tagFilters.map((filter) => (
            <button
              key={filter.category}
              type="button"
              aria-pressed={category === filter.category}
              onClick={() => selectCategory(filter.category)}
              className={ui(
                `inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-all duration-300 ${
                  category === filter.category
                    ? 'bg-home-accent-soft text-home-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,_var(--home-accent)_35%,_transparent)]'
                    : 'bg-home-card text-home-muted hover:bg-home-hover hover:text-home-text'
                }`,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
