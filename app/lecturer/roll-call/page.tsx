'use client';

import PageLayout from '@/components/shared/PageLayout';
import { RollCallSection } from '@/components/lecturer/sections';

export default function RollCallPage() {
  return (
    <PageLayout role="lecturer">
      <RollCallSection />
    </PageLayout>
  );
}