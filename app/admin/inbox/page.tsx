'use client';

import PageLayout from '@/components/shared/PageLayout';
import { InboxSection } from '@/components/admin/sections';

export default function InboxPage() {
  return (
    <PageLayout role="admin">
      <InboxSection />
    </PageLayout>
  );
}
