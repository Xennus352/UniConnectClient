'use client';

import PageLayout from '@/components/shared/PageLayout';
import { EventsSection } from '@/components/student/sections';

export default function EventsPage() {
  return (
    <PageLayout role="student">
      <EventsSection />
    </PageLayout>
  );
}
