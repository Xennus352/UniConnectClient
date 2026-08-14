'use client';

import PageLayout from '@/components/shared/PageLayout';
import UserManagementSection from '@/components/shared/UserManagementSection';

export default function ManageStudentsPage() {
  return (
    <PageLayout role="admin">
      <UserManagementSection target="students" />
    </PageLayout>
  );
}