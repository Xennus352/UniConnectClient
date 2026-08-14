'use client';

import PageLayout from '@/components/shared/PageLayout';
import { Dashboard } from '@/components/admin/sections';

export default function AdminPage() {
  return (
    <PageLayout role="admin">
      <Dashboard />
    </PageLayout>
  );
}
