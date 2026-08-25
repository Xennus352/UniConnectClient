'use client';

import PageLayout from '@/components/shared/PageLayout';
import { RollCallWorkspace } from '@/components/lecturer/sections';

export default function RollCallPage() {
  return (
    <PageLayout role="lecturer">
      <RollCallWorkspace />
    </PageLayout>
  );
}
