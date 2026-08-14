'use client';

import PageLayout from '@/components/shared/PageLayout';
import { MessagesSection } from '@/components/lecturer/sections';

export default function MessagesPage() {
  return (
    <PageLayout role="lecturer">
      <MessagesSection />
    </PageLayout>
  );
}