'use client';

import PageLayout from '@/components/shared/PageLayout';
import AdministrativeSection from '@/components/shared/AdministrativeSection';

export default function StudentAffairsPage() {
  return (
    <PageLayout role="admin">
      <AdministrativeSection target="student-affairs" />
    </PageLayout>
  );
}