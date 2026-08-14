'use client';

import PageLayout from '@/components/shared/PageLayout';
import { RollCallSection } from '@/components/admin/sections';

export default function RollCallPage() {
  return (
    <PageLayout role="admin">
      <RollCallSection />
    </PageLayout>
  );
}
