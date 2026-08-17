'use client';

import PageLayout from '@/components/shared/PageLayout';
import { AnnouncementsSection } from '@/components/student/sections';

export default function AnnouncementsPage() {
  return (
    <PageLayout role="student">
      <AnnouncementsSection />
    </PageLayout>
  );
}