'use client';

import PageLayout from '@/components/shared/PageLayout';
import { SettingsSection } from '@/components/lecturer/sections';

export default function SettingsPage() {
  return (
    <PageLayout role="lecturer">
      <SettingsSection />
    </PageLayout>
  );
}