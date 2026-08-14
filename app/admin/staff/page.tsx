'use client';

import PageLayout from '@/components/shared/PageLayout';
import { StaffSection } from '@/components/admin/sections';

export default function StaffPage() {
  return (
    <PageLayout role="admin">
      <StaffSection />
    </PageLayout>
  );
}
