'use client';

import PageLayout from '@/components/shared/PageLayout';
import { EventsSection } from '@/components/admin/sections';

export default function EventsPage() {
  return (
    <PageLayout role="admin">
      <EventsSection />
    </PageLayout>
  );
}
