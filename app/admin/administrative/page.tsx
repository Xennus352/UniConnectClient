'use client';

import PageLayout from '@/components/shared/PageLayout';
import AdministrativeSection from '@/components/shared/AdministrativeSection';

export default function AdministrativePage() {
  return (
    <PageLayout role="admin">
      <AdministrativeSection target="administrative-officers" />
    </PageLayout>
  );
}