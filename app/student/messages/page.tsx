'use client';

import PageLayout from '@/components/shared/PageLayout';
import { MessagesSection } from '@/components/student/sections';

export default function MessagesPage() {
  return (
    <PageLayout role="student">
      <MessagesSection />
    </PageLayout>
  );
}
