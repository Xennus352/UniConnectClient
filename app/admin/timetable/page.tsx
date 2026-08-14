'use client';

import PageLayout from '@/components/shared/PageLayout';
import { TimetableSection } from '@/components/admin/sections';

export default function TimetablePage() {
  return (
    <PageLayout role="admin">
      <TimetableSection />
    </PageLayout>
  );
}
