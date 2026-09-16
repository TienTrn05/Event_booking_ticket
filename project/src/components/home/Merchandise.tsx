import { useState } from 'react';
import { ShoppingBag, ChevronRight, Calendar, BadgeCheck, ExternalLink, Star, ArrowRight } from 'lucide-react';
import { merchandise, organizers } from '@/data/mockData';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatPrice } from '@/utils/format';

const badgeVariant: Record<string, 'primary' | 'warning' | 'success'> = {
  New: 'primary',
  Limited: 'warning',
  'Best Seller': 'success',
};

export default function Merchandise() {
  const merchOrgs = organizers.filter((org) => org.hasMerchandise);
  const [activeOrg, setActiveOrg] = useState<string>(merchOrgs[0]?.id ?? '');
  const selectedOrg = merchOrgs.find((org) => org.id === activeOrg) ?? merchOrgs[0];
  const selectedProducts = merchandise.filter((product) => product.organizerId === selectedOrg?.id);
  const bannerImage = selectedProducts[0]?.image ?? selectedOrg?.avatar;

  return (
    <section id="merchandise" className="py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-700 mb-3">
              <ShoppingBag size={14} />
              <span className="text-xs font-bold uppercase tracking-wide">Official Artist Store</span>
            </div>
            <h2 className="text-2xl lg:text-4xl font-extrabold text-ink-900 tracking-tight">
              Merchandise
            </h2>
            <p className="text-sm text-ink-500 mt-2 max-w-lg">
              Chọn một nghệ sĩ để khám phá bộ sưu tập chính thức gắn với sự kiện của họ.
            </p>
          </div>
          <button className="flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900 transition-colors">
            Shop all products
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Artist storefront selector */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3 mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
          {merchOrgs.map((org) => {
            const count = merchandise.filter((product) => product.organizerId === org.id).length;
            const isActive = activeOrg === org.id;
            return (
              <button
                key={org.id}
                onClick={() => setActiveOrg(org.id)}
                className={`group flex-shrink-0 w-[112px] sm:w-[128px] rounded-2xl p-3 text-center transition-all duration-300 ${
                  isActive
                    ? 'bg-white shadow-card-hover ring-2 ring-primary-500 -translate-y-1'
                    : 'bg-white/70 border border-ink-100 hover:bg-white hover:-translate-y-0.5'
                }`}
              >
                <div className="relative mx-auto mb-2 w-14 h-14 sm:w-16 sm:h-16">
                  <img
                    src={org.avatar}
                    alt={org.name}
                    className={`w-full h-full rounded-full object-cover transition-all duration-300 ${isActive ? 'ring-4 ring-primary-100' : 'ring-2 ring-ink-100 group-hover:ring-primary-100'}`}
                    loading="lazy"
                  />
                  {org.verified && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <BadgeCheck size={15} className="text-primary-600 fill-primary-100" />
                    </span>
                  )}
                </div>
                <span className={`block text-xs font-bold truncate ${isActive ? 'text-primary-700' : 'text-ink-800'}`}>
                  {org.name}
                </span>
                <span className="block text-[11px] text-ink-400 mt-0.5">{count} items</span>
              </button>
            );
          })}
        </div>

        {/* One artist banner at a time */}
        {selectedOrg && (
          <div className="animate-fade-in">
            <div className="relative min-h-[230px] sm:min-h-[280px] rounded-3xl overflow-hidden bg-ink-900 shadow-elevated mb-8">
              <img
                src={bannerImage}
                alt={`${selectedOrg.name} merchandise collection`}
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-[2px] opacity-50 transition-transform duration-1000"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/80 to-ink-900/20" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_45%,rgba(232,93,44,0.45),transparent_34%)]" />
              <div className="absolute -right-10 -top-20 w-72 h-72 rounded-full border border-white/10 animate-[spin_22s_linear_infinite]" />
              <div className="absolute -right-2 -top-12 w-56 h-56 rounded-full border border-primary-400/20 animate-[spin_16s_linear_infinite_reverse]" />

              <div className="relative z-10 min-h-[230px] sm:min-h-[280px] flex items-center px-6 sm:px-10 py-8">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="primary" className="bg-primary-500 text-white">
                      <ShoppingBag size={13} /> Official collection
                    </Badge>
                    <span className="text-xs font-semibold text-white/60">{selectedProducts.length} items</span>
                  </div>
                  <h3 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.05]">
                    {selectedOrg.name}
                  </h3>
                  <p className="text-white/70 text-sm sm:text-base mt-3 max-w-md">
                    Bộ sưu tập chính thức dành cho người hâm mộ và cộng đồng của {selectedOrg.name}.
                  </p>
                  {selectedOrg.upcomingEventTitle && (
                    <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm font-medium mt-5">
                      <Calendar size={15} className="text-primary-300" />
                      <span>{selectedOrg.upcomingEventTitle} · {selectedOrg.upcomingEventDate}</span>
                    </div>
                  )}
                </div>
                <div className="hidden md:flex ml-auto items-center gap-3 pr-2">
                  {selectedProducts.slice(0, 3).map((product, index) => (
                    <img
                      key={product.id}
                      src={product.image}
                      alt={product.name}
                      className={`w-24 h-24 lg:w-32 lg:h-32 rounded-2xl object-cover shadow-elevated border border-white/20 transition-transform duration-500 hover:scale-105 ${index === 1 ? '-translate-y-5 rotate-3' : index === 2 ? 'translate-y-4 -rotate-3' : 'rotate-[-4deg]'}`}
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl lg:text-2xl font-extrabold text-ink-900">Danh sách sản phẩm</h3>
                <p className="text-sm text-ink-400 mt-1">Official products from {selectedOrg.name}</p>
              </div>
              <Button variant="outline" size="sm" className="hidden sm:flex">
                Visit store <ExternalLink size={14} />
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {selectedProducts.map((product) => (
                <article
                  key={product.id}
                  className="group bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden transition-all duration-300 hover:shadow-elevated hover:-translate-y-1.5 cursor-pointer"
                >
                  <div className="relative aspect-square overflow-hidden bg-ink-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {product.badge && (
                      <div className="absolute top-2.5 left-2.5">
                        <Badge variant={badgeVariant[product.badge] ?? 'default'}>
                          {product.badge === 'Best Seller' && <Star size={10} className="fill-current" />}
                          {product.badge}
                        </Badge>
                      </div>
                    )}
                    <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                      <ShoppingBag size={18} className="text-ink-900" />
                    </div>
                  </div>
                  <div className="p-3.5">
                    <h4 className="text-sm font-bold text-ink-900 leading-snug mb-1.5 line-clamp-2 group-hover:text-primary-700 transition-colors">
                      {product.name}
                    </h4>
                    <p className="text-xs text-ink-400 font-medium mb-3 truncate flex items-center gap-1">
                      <Calendar size={11} className="flex-shrink-0" />
                      {product.eventTitle}
                    </p>
                    <div className="flex items-center justify-between pt-2.5 border-t border-ink-100">
                      <span className="text-base font-extrabold text-ink-900">
                        {formatPrice(product.price, product.currency)}
                      </span>
                      <span className="text-xs font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Add <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
