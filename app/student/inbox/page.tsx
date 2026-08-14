'use client';

import PageLayout from '@/components/shared/PageLayout';
import { InboxSection } from '@/components/student/sections';

export default function InboxPage() {
  return (
    <PageLayout role="student">
      <InboxSection />
    </PageLayout>
  );
}
