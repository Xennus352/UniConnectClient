'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ActivitySection } from '@/components/admin/sections';

export default function ActivityPage() {
  return (
    <PageLayout role="admin">
      <ActivitySection />
    </PageLayout>
  );
}
