'use client';

import PageLayout from '@/components/shared/PageLayout';
import { StudentsSection } from '@/components/lecturer/sections';

export default function StudentsPage() {
  return (
    <PageLayout role="lecturer">
      <StudentsSection />
    </PageLayout>
  );
}