'use client';

import PageLayout from '@/components/shared/PageLayout';
import UserManagementSection from '@/components/shared/UserManagementSection';

export default function ManageStudentAffairsPage() {
  return (
    <PageLayout role="admin">
      <UserManagementSection target="student-affairs" />
    </PageLayout>
  );
}