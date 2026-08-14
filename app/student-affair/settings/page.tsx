'use client';

import PageLayout from '@/components/shared/PageLayout';
import { SettingsSection } from '@/components/student-affairs/sections';

export default function SettingsPage() {
  return (
    <PageLayout role="student-affair">
      <SettingsSection />
    </PageLayout>
  );
}
