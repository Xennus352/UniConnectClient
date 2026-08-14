'use client';

import PageLayout from '@/components/shared/PageLayout';
import { LecturersSection } from '@/components/admin/sections';

export default function LecturersPage() {
  return (
    <PageLayout role="admin">
      <LecturersSection />
    </PageLayout>
  );
}
