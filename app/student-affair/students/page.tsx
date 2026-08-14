'use client';

import PageLayout from '@/components/shared/PageLayout';
import { StudentsSection } from '@/components/student-affairs/sections';

export default function StudentsPage() {
  return (
    <PageLayout role="student-affair">
      <StudentsSection />
    </PageLayout>
  );
}
