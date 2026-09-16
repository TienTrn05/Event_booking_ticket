import Hero from '@/components/home/Hero';
import CatalogTabs from '@/components/home/CatalogTabs';
import FeaturedOrganizers from '@/components/home/FeaturedOrganizers';
import FeaturedEvents from '@/components/home/FeaturedEvents';
import ExploreEvents from '@/components/home/ExploreEvents';
import ResaleTickets from '@/components/home/ResaleTickets';
import BrowseByLocation from '@/components/home/BrowseByLocation';
import OfficialPartnerEvents from '@/components/home/OfficialPartnerEvents';
import Merchandise from '@/components/home/Merchandise';
import BlogPreview from '@/components/home/BlogPreview';
import OrganizerCTA from '@/components/home/OrganizerCTA';
import Footer from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <>
      <Hero />
      <CatalogTabs />
      <main>
        <FeaturedOrganizers />
        <FeaturedEvents />
        <ExploreEvents />
        <ResaleTickets />
        <BrowseByLocation />
        <OfficialPartnerEvents />
        <Merchandise />
        <BlogPreview />
        <OrganizerCTA />
      </main>
      <Footer />
    </>
  );
}
