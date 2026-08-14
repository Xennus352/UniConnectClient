'use client';

import PageLayout from '@/components/shared/PageLayout';
import { MessagesSection } from '@/components/student-affairs/sections';

export default function MessagesPage() {
  return (
    <PageLayout role="student-affair">
      <MessagesSection />
    </PageLayout>
  );
}
