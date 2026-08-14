'use client';

import PageLayout from '@/components/shared/PageLayout';
import { FeedSection } from '@/components/admin/sections';

export default function FeedPage() {
  return (
    <PageLayout role="admin">
      <FeedSection />
    </PageLayout>
  );
}
