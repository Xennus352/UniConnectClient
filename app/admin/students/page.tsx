'use client';

import PageLayout from '@/components/shared/PageLayout';
import { StudentsSection } from '@/components/admin/sections';

export default function StudentsPage() {
  return (
    <PageLayout role="admin">
      <StudentsSection />
    </PageLayout>
  );
}
