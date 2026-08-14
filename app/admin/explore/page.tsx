'use client';

import PageLayout from '@/components/shared/PageLayout';
import { ExploreSection } from '@/components/admin/sections';

export default function ExplorePage() {
  return (
    <PageLayout role="admin">
      <ExploreSection />
    </PageLayout>
  );
}
