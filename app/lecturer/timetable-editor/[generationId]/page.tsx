'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import PageLayout from '@/components/shared/PageLayout';
import { TimetableEditSection } from '@/components/lecturer/sections';

export default function TimetableEditorPage() {
  const params = useParams<{ generationId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const semRaw = searchParams?.get('semester');
  const sectionRaw = searchParams?.get('section') ?? '';
  const semester = semRaw ? Number(semRaw) : NaN;

  return (
    <PageLayout role="lecturer">
      {Number.isNaN(semester) || !sectionRaw ? (
        <div className="flex items-center justify-center" style={{ minHeight: 300 }}>
          <div className="text-center">
            <p style={{ fontSize: 14, color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>
              Missing semester/section context for this timetable.
            </p>
            <button
              onClick={() => router.push('/lecturer/timetable-generation')}
              className="btn btn-sm cursor-pointer"
              style={{ color: 'var(--primary)' }}
            >
              Back to Generation
            </button>
          </div>
        </div>
      ) : (
        <TimetableEditSection
          generationId={params.generationId}
          semesterNo={semester}
          section={sectionRaw}
          onBack={() => router.push('/lecturer/timetable-generation')}
        />
      )}
    </PageLayout>
  );
}
