import Hero from '../components/home/Hero';
import CatalogTabs from '../components/home/CatalogTabs';
import SectionDock from '../components/home/SectionDock';
import FeaturedOrganizers from '../components/home/FeaturedOrganizers';
import FeaturedEvents from '../components/home/FeaturedEvents';
import ExploreEvents from '../components/home/ExploreEvents';
import ResaleTickets from '../components/home/ResaleTickets';
import BrowseByLocation from '../components/home/BrowseByLocation';
import OfficialPartnerEvents from '../components/home/OfficialPartnerEvents';
import MerchandiseSection from '../../merchandise/components/home/MerchandiseSection';
import BlogPreview from '../../content/components/BlogPreview';

import { useScrollReveal } from '../../../shared/motion/useScrollReveal';
import { homeMotion } from '../../../shared/motion/classes';
import { useState } from 'react';
import type { EventCategory } from '../types/index';

export function HomePage() {
  const revealRoot = useScrollReveal();
  const [category, setCategory] = useState<EventCategory | 'All'>('Music');
  return (
    <div ref={revealRoot} className={`contents ${homeMotion}`}>
      <Hero />
      <CatalogTabs category={category} onCategoryChange={setCategory} />
      <SectionDock />
      <main id="main">
        <FeaturedOrganizers />
        <FeaturedEvents />
        <ExploreEvents category={category} onCategoryChange={setCategory} />
        <ResaleTickets />
        <BrowseByLocation />
        <OfficialPartnerEvents />
        <MerchandiseSection />
        <BlogPreview />
      </main>
    </div>
  );
}
