'use client';

import { useParams } from 'next/navigation';
import PageLayout from '@/components/shared/PageLayout';
import PersonProfileSection from '@/components/shared/PersonProfileSection';
import { useSession } from '@/components/shared/session';

export default function PeopleProfilePage() {
  const params = useParams<{ email: string }>();
  const email = typeof params?.email === 'string' ? decodeURIComponent(params.email) : '';
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <PageLayout role={user?.role ?? 'student'}>
      <PersonProfileSection email={email} />
    </PageLayout>
  );
}
