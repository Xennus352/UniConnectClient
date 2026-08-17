'use client';

import PageLayout from '@/components/shared/PageLayout';
import { AnnouncementsSection } from '@/components/lecturer/sections';

export default function AnnouncementsPage() {
  return (
    <PageLayout role="lecturer">
      <AnnouncementsSection />
    </PageLayout>
  );
}