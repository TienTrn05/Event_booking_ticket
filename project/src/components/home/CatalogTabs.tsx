import { useEffect, useRef, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { catalogTabs } from '@/data/mockData';

export default function CatalogTabs() {
  const [active, setActive] = useState<string>(catalogTabs[0]);
  const [isFloating, setIsFloating] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      setIsFloating(section.getBoundingClientRect().bottom < 72 && window.scrollY > 120);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleTabClick = (tab: string) => {
    setActive(tab);
    const targetId: Record<string, string> = {
      'Nhạc sống': 'trending',
      'Thể thao': 'upcoming',
      'Sân khấu & Nghệ thuật': 'featured',
      'Hội thảo & Workshop': 'discover',
      'Tham quan & Trải nghiệm': 'locations',
      'Khác': 'discover',
      'Vé bán lại': 'resale',
      Merchandise: 'merchandise',
      Blog: 'blog',
    };
    document.getElementById(targetId[tab] ?? 'discover')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const tabButtons = (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-3">
      {catalogTabs.map((tab) => (
        <button
          key={tab}
          onClick={() => handleTabClick(tab)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-all ${
            active === tab
              ? 'bg-ink-900 text-white shadow-sm'
              : 'bg-ink-50 text-ink-600 hover:bg-ink-100 hover:text-ink-900'
          }`}
        >
          {tab === 'Merchandise' && <ShoppingBag size={14} />}
          {tab}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <section ref={sectionRef} id="categories" className="relative z-30 border-b border-ink-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{tabButtons}</div>
      </section>
      {isFloating && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 animate-slide-up">
          <div className="max-w-4xl mx-auto rounded-2xl border border-ink-200/80 bg-white/95 px-2 shadow-elevated backdrop-blur-xl">
            {tabButtons}
          </div>
        </div>
      )}
    </>
  );
}
