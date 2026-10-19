import { Navigate, useSearchParams } from 'react-router-dom';
import Hero from '../components/home/Hero';
import FeaturedOrganizers from '../components/home/FeaturedOrganizers';
import FeaturedEvents from '../components/home/FeaturedEvents';
import RecommendedEvents from '../components/home/RecommendedEvents';
import HomeDiscovery from '../components/home/HomeDiscovery';
import ResaleTickets from '../components/home/ResaleTickets';
import MerchandiseSection from '../../merchandise/components/home/MerchandiseSection';
import BlogPreview from '../../content/components/BlogPreview';
import { CatalogState } from '../../catalog/components/CatalogState';
import { useScrollReveal } from '../../../shared/motion/useScrollReveal';
import { useCatalog } from '../../catalog/hooks/useCatalog';

export function HomePage() {
  const revealRoot = useScrollReveal();
  const [params] = useSearchParams();
  const { catalog } = useCatalog();
  if (['q', 'category', 'city', 'sort'].some((key) => params.has(key)))
    return <Navigate to={`/events?${params}`} replace />;
  return (
    <main id="main" ref={revealRoot} className="home-motion min-w-0">
      <Hero />
      <CatalogState empty={!catalog.events.length} compact />
      <FeaturedEvents />
      <HomeDiscovery />
      <ResaleTickets />
      <RecommendedEvents />
      <FeaturedOrganizers />
      <MerchandiseSection />
      <BlogPreview />
    </main>
  );
}
