'use client';

import PageLayout from '@/components/shared/PageLayout';
import UserManagementSection from '@/components/shared/UserManagementSection';

export default function ManageAdminsPage() {
  return (
    <PageLayout role="admin">
      <UserManagementSection target="admins" />
    </PageLayout>
  );
}