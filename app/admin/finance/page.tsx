'use client';

import PageLayout from '@/components/shared/PageLayout';
import { FinanceSection } from '@/components/admin/sections';

export default function FinancePage() {
  return (
    <PageLayout role="admin">
      <FinanceSection />
    </PageLayout>
  );
}
