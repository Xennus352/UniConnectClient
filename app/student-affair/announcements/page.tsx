'use client';

import PageLayout from '@/components/shared/PageLayout';
import { AnnouncementsSection } from '@/components/student-affairs/sections';

export default function AnnouncementsPage() {
  return (
    <PageLayout role="student-affair">
      <AnnouncementsSection />
    </PageLayout>
  );
}