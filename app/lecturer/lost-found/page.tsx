'use client';

import PageLayout from '@/components/shared/PageLayout';
import { LostFoundSection } from '@/components/lecturer/sections';

export default function LostFoundPage() {
  return (
    <PageLayout role="lecturer">
      <LostFoundSection />
    </PageLayout>
  );
}