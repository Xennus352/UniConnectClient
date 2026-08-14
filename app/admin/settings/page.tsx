'use client';

import PageLayout from '@/components/shared/PageLayout';
import { SettingsSection } from '@/components/admin/sections';

export default function SettingsPage() {
  return (
    <PageLayout role="admin">
      <SettingsSection />
    </PageLayout>
  );
}
