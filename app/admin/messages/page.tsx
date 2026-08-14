'use client';

import PageLayout from '@/components/shared/PageLayout';
import { MessagesSection } from '@/components/admin/sections';

export default function MessagesPage() {
  return (
    <PageLayout role="admin">
      <MessagesSection />
    </PageLayout>
  );
}
