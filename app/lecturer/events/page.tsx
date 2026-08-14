'use client';

import PageLayout from '@/components/shared/PageLayout';
import { EventsSection } from '@/components/lecturer/sections';

export default function EventsPage() {
  return (
    <PageLayout role="lecturer">
      <EventsSection />
    </PageLayout>
  );
}