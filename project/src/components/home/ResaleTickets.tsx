import { ShieldCheck, Clock, MapPin, Calendar, ArrowRight, TicketCheck, Flame, BadgeCheck } from 'lucide-react';
import { resaleTickets } from '@/data/mockData';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatPrice } from '@/utils/format';

export default function ResaleTickets() {
  return (
    <section className="py-16 lg:py-24 bg-ink-900 relative overflow-hidden">
      <div className="absolute -top-32 -right-20 w-[500px] h-[500px] rounded-full bg-primary-600/20 blur-[110px] pointer-events-none" />
      <div className="absolute -bottom-48 left-1/4 w-[420px] h-[420px] rounded-full bg-primary-400/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/15 border border-primary-400/20 mb-4">
              <Flame size={14} className="text-primary-300 animate-pulse" />
              <span className="text-xs font-bold text-primary-200 uppercase tracking-wide">Last chance</span>
            </div>
            <h2 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Resale tickets <span className="text-primary-400">before they're gone.</span>
            </h2>
            <p className="text-white/60 text-base leading-relaxed mt-3 max-w-2xl">
              Verified tickets from real fans, with transparent pricing and secure transfer.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <TicketCheck size={19} className="text-primary-400" />
              <div><span className="block text-sm font-extrabold text-white">100%</span><span className="block text-[11px] text-white/50">Verified</span></div>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <BadgeCheck size={19} className="text-emerald-400" />
              <div><span className="block text-sm font-extrabold text-white">24/7</span><span className="block text-[11px] text-white/50">Support</span></div>
            </div>
            <Button variant="outline" size="md" className="border-white/15 text-white hover:bg-white/10 hover:border-white/25">Explore market <ArrowRight size={16} /></Button>
          </div>
        </div>

        <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
          {resaleTickets.map((ticket, index) => (
            <article key={ticket.id} className="group flex-shrink-0 w-[310px] sm:w-[350px] bg-white rounded-2xl overflow-hidden shadow-elevated transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(232,93,44,0.25)] animate-slide-up snap-start" style={{ animationDelay: `${index * 90}ms`, animationFillMode: 'both' }}>
              <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
                <img src={ticket.image} alt={ticket.eventTitle} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/75 via-transparent to-transparent" />
                <div className="absolute top-3 left-3"><Badge variant="success" className="shadow-lg"><ShieldCheck size={12} /> Verified resale</Badge></div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white"><span className="flex items-center gap-1.5 text-xs font-bold"><Clock size={14} className="text-primary-300" />{ticket.timeLeft}</span><span className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Secondary market</span></div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs text-ink-400 mb-2"><Calendar size={14} className="text-primary-500" /><span className="font-semibold">{ticket.dateLabel}</span></div>
                <h3 className="text-base font-extrabold text-ink-900 leading-snug mb-2 line-clamp-2 group-hover:text-primary-700 transition-colors">{ticket.eventTitle}</h3>
                <div className="flex items-center gap-1.5 text-sm text-ink-500 mb-3"><MapPin size={14} className="flex-shrink-0" /><span className="truncate">{ticket.venue}, {ticket.city}</span></div>
                <div className="flex items-center justify-between gap-3 bg-ink-50 rounded-xl px-3 py-2.5 mb-4"><div className="min-w-0"><span className="block text-[11px] text-ink-400 font-semibold uppercase tracking-wide">Your seat</span><span className="block text-xs text-ink-700 font-bold truncate">{ticket.seatInfo}</span></div>{ticket.sellerVerified && <ShieldCheck size={18} className="text-emerald-500 flex-shrink-0" />}</div>
                <div className="flex items-end justify-between pt-3 border-t border-ink-100"><div className="flex flex-col"><span className="text-xs text-ink-400 font-medium line-through">Original {formatPrice(ticket.originalPrice, ticket.currency)}</span><span className="text-xl font-extrabold text-primary-600">{formatPrice(ticket.resalePrice, ticket.currency)}</span></div><Button size="sm" className="group-hover:shadow-lg group-hover:shadow-primary-500/20">Buy ticket <ArrowRight size={14} /></Button></div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
