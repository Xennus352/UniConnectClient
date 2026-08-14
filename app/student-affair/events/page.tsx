'use client';

import PageLayout from '@/components/shared/PageLayout';
import { EventsSection } from '@/components/student-affairs/sections';

export default function EventsPage() {
  return (
    <PageLayout role="student-affair">
      <EventsSection />
    </PageLayout>
  );
}
