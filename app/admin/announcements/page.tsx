'use client';

import PageLayout from '@/components/shared/PageLayout';
import { AnnouncementsSection } from '@/components/admin/sections';

export default function AnnouncementsPage() {
  return (
    <PageLayout role="admin">
      <AnnouncementsSection />
    </PageLayout>
  );
}