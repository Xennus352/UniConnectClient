'use client';

import PageLayout from '@/components/shared/PageLayout';
import { SettingsSection } from '@/components/student/sections';

export default function SettingsPage() {
  return (
    <PageLayout role="student">
      <SettingsSection />
    </PageLayout>
  );
}
