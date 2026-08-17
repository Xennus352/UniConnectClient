'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Settings, FileText, GraduationCap, Send, Loader2,
  X, Check, FileWarning, Filter, Eye, Download, Rocket,
  Archive, Trash2, History, Layers, Sparkles, Search, RotateCcw,
} from 'lucide-react';
import { apiFetch, type StudentRecord, type AcademicTermRecord } from './api';
import { useUniversityData } from './useUniversityData';
import { useUniversityRaw, clearUniversityRawCache } from './useUniversityPeople';
import { toast } from 'sonner';
import { useSupabase } from '@/utils/supabase/client';

const ROLL_RE = /\((UCSTGO-\d+)\)\.pdf$/i;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES = 200;

interface ParsedFile {
  id: string;
  fileName: string;
  rollNo: string | null;
  dataUrl: string | null;
  error: string | null;
}

interface DistributeResult {
  fileName: string;
  rollNo: string;
  ok: boolean;
  error?: string;
}

interface ExamBatchRow {
  id: string;
  exam_type: string;
  semester: string;
  academic_year: string;
  total_files: number;
  status: string;
  created_by: string | null;
  created_at: number;
}

interface HistoryRow {
  id: string;
  user_id: string | null;
  recipient_email: string;
  roll_number: string;
  year: string;
  semester: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  created_at: number;
  batch_id: string | null;
  student_name: string | null;
}

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');

const filterOptions = [
  { id: 'all', label: 'All' },
  { id: 'matched', label: 'Matched' },
  { id: 'unmatched', label: 'Unmatched' },
] as const;

type FilterId = (typeof filterOptions)[number]['id'];

type TabId = 'upload' | 'batches' | 'history';

const EXAM_TYPES = ['Mid Term', 'Final Term'] as const;

const HISTORY_SEMESTERS = Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`);
const HISTORY_EXAM_TYPES = ['Mid Term', 'Final Term'];

const escapeOrValue = (v: string): string => v.replace(/[\\%_]/g, '').replace(/,/g, '\\,');

const statusBadge = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'PUBLISHED') {
    return <span className="badge badge-success badge-sm" style={{ fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Published</span>;
  }
  if (s === 'UPLOADED') {
    return <span className="badge badge-warning badge-sm" style={{ fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', background: 'rgba(245,158,11,0.15)', color: '#b45309', border: 'none' }}>Uploaded</span>;
  }
  if (s === 'ARCHIVED') {
    return <span className="badge badge-sm" style={{ fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', background: 'var(--divider-soft)', color: 'var(--text-light)', border: 'none' }}>Archived</span>;
  }
  return <span className="badge badge-ghost badge-sm" style={{ fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Draft</span>;
};

export default function ExamResultDistributionSection() {
  const supabase = useSupabase();
  const { students, loading: studentsLoading, refresh } = useUniversityRaw();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [filter, setFilter] = useState<FilterId>('all');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [lastResults, setLastResults] = useState<DistributeResult[] | null>(null);
  const [tab, setTab] = useState<TabId>('upload');
  const [filePage, setFilePage] = useState(1);
  const [resultPage, setResultPage] = useState(1);

  const [batches, setBatches] = useState<ExamBatchRow[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyBatch, setHistoryBatch] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historySemester, setHistorySemester] = useState('ALL');
  const [historyExamType, setHistoryExamType] = useState('ALL');
  const [viewer, setViewer] = useState<HistoryRow | null>(null);

  const { data: terms } = useUniversityData<AcademicTermRecord[]>(
    useCallback(() => apiFetch<AcademicTermRecord[]>('/api/terms'), [])
  );

  const yearOptions = useMemo(() => {
    const years = [...new Set((terms ?? []).map((t) => t.academicYear))].sort((a, b) => b - a);
    return years.length > 0 ? years.map((y) => String(y)) : ['2025-2026', '2024-2025'];
  }, [terms]);

  const [year, setYear] = useState<string>('');
  const [examType, setExamType] = useState<string>(EXAM_TYPES[0]);

  const effectiveYear = year || yearOptions[0] || '2025-2026';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('exam_results')
        .select('*', { count: 'exact', head: true });
      if (!cancelled) setSentCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const loadBatches = useCallback(async () => {
    const { data } = await supabase
      .from('exam_result_batches')
      .select('id, exam_type, semester, academic_year, total_files, status, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setBatches(data as unknown as ExamBatchRow[]);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState only after await
    void loadBatches();
  }, [loadBatches]);

  const historyIdsRef = useRef<Set<string>>(new Set());

  const loadHistory = useCallback(async () => {
    const batchFilter = historyBatch === 'all' ? null : historyBatch;
    let query = supabase
      .from('exam_results')
      .select('id, user_id, recipient_email, roll_number, year, semester, file_name, file_url, storage_path, created_at, batch_id, student_name', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (batchFilter) query = query.eq('batch_id', batchFilter);
    if (historySemester !== 'ALL') query = query.eq('semester', historySemester);
    if (historyExamType !== 'ALL') {
      const { data: typeBatches } = await supabase
        .from('exam_result_batches')
        .select('id')
        .eq('exam_type', historyExamType);
      const typeIds = (typeBatches ?? []).map((b) => b.id);
      if (typeIds.length === 0) {
        historyIdsRef.current = new Set();
        setHistory([]);
        setHistoryTotal(0);
        return;
      }
      query = query.in('batch_id', typeIds);
    }
    if (historySearch.trim()) {
      const q = escapeOrValue(historySearch.trim());
      query = query.or(`roll_number.ilike.%${q}%,student_name.ilike.%${q}%`);
    }
    const from = (historyPage - 1) * historyPageSize;
    const { data, count } = await query.range(from, from + historyPageSize - 1);
    if (data) {
      historyIdsRef.current = new Set((data as unknown as HistoryRow[]).map((r) => r.id));
      setHistory(data as unknown as HistoryRow[]);
      setHistoryTotal(count ?? 0);
    }
  }, [supabase, historyPage, historyPageSize, historyBatch, historySearch, historySemester, historyExamType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState only after await
    void loadHistory();
  }, [loadHistory]);

  const historyBatchRef = useRef('all');
  useEffect(() => {
    historyBatchRef.current = historyBatch;
  }, [historyBatch]);

  const loadBatchesRef = useRef(loadBatches);
  useEffect(() => {
    loadBatchesRef.current = loadBatches;
  }, [loadBatches]);

  const loadHistoryRef = useRef(loadHistory);
  useEffect(() => {
    loadHistoryRef.current = loadHistory;
  }, [loadHistory]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-exam-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_result_batches' },
        (payload) => {
          const old = payload.old as { id?: string } | null;
          if (payload.eventType === 'DELETE' && old?.id && historyBatchRef.current === old.id) {
            setHistoryBatch('all');
          }
          void loadBatchesRef.current();
          void loadHistoryRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_results' },
        () => {
          void loadHistoryRef.current();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const batchLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of batches ?? []) map.set(b.id, `${b.exam_type} • ${b.semester} • ${b.academic_year}`);
    return map;
  }, [batches]);

  const batchOptions = useMemo(
    () => (batches ?? []).map((b) => ({ id: b.id, label: `${b.exam_type} • ${b.semester} • ${b.academic_year}` })),
    [batches]
  );

  const studentByRoll = useMemo(() => {
    const map = new Map<string, StudentRecord>();
    for (const s of students) map.set(s.rollNo.toUpperCase(), s);
    return map;
  }, [students]);

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  const handleFiles = useCallback(async (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      toast.error('Only PDF files are accepted');
      return;
    }
    const tooBig = pdfs.filter((f) => f.size > MAX_FILE_SIZE);
    if (tooBig.length > 0) {
      toast.error(`${tooBig[0].name} exceeds the 15MB limit`);
      return;
    }
    if (pdfs.length > MAX_FILES) {
      toast.error(`At most ${MAX_FILES} files can be uploaded at once`);
      return;
    }

    const fresh = pdfs.filter((f) => !seenNamesRef.current.has(f.name.toLowerCase()));
    const dupes = pdfs.filter((f) => seenNamesRef.current.has(f.name.toLowerCase()));
    if (dupes.length > 0) toast.warning(`${dupes[0].name} is already in the list`);

    const next: ParsedFile[] = [];
    for (const file of fresh) {
      const match = file.name.match(ROLL_RE);
      const rollNo = match ? match[1].toUpperCase() : null;
      let dataUrl: string | null = null;
      let error: string | null = null;
      try {
        dataUrl = await readAsDataUrl(file);
      } catch {
        error = 'Could not read file';
      }
      next.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        rollNo,
        dataUrl,
        error,
      });
    }
    if (next.length > 0) {
      for (const n of next) seenNamesRef.current.add(n.fileName.toLowerCase());
      setParsedFiles((prev) => [...prev, ...next]);
      setLastResults(null);
    }
  }, []);

  const seenNamesRef = useRef<Set<string>>(new Set());

  const studentOf = useCallback(
    (f: ParsedFile): StudentRecord | null => (f.rollNo ? studentByRoll.get(f.rollNo) ?? null : null),
    [studentByRoll]
  );

  const semesterOf = useCallback(
    (f: ParsedFile): string | null => {
      const s = studentOf(f);
      return s && s.semesterNo > 0 ? `Semester ${s.semesterNo}` : null;
    },
    [studentOf]
  );

  const visibleFiles = useMemo(
    () =>
      parsedFiles.filter((f) => {
        if (filter === 'all') return true;
        const matched = Boolean(f.rollNo && studentByRoll.has(f.rollNo.toUpperCase()));
        return filter === 'matched' ? matched : !matched;
      }),
    [parsedFiles, filter, studentByRoll]
  );

  const matchedFiles = useMemo(
    () => parsedFiles.filter((f) => f.rollNo && studentByRoll.has(f.rollNo.toUpperCase()) && f.dataUrl),
    [parsedFiles, studentByRoll]
  );
  const matchedCount = matchedFiles.length;
  const unmatchedCount = parsedFiles.length - matchedCount;

  const semesterCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of matchedFiles) {
      const sem = semesterOf(f);
      if (sem) map.set(sem, (map.get(sem) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [matchedFiles, semesterOf]);

  const storagePathOf = (f: ParsedFile): string => {
    const roll = f.rollNo ?? 'UCSTGO-XXXX';
    const sem = semesterOf(f) ?? 'Semester X';
    return `exam-results/${effectiveYear}/${sem}/${roll}_exam_result.pdf`;
  };

  const FILE_PAGE_SIZE = 20;
  const fileTotalPages = Math.max(1, Math.ceil(visibleFiles.length / FILE_PAGE_SIZE));
  const filePageSafe = Math.min(filePage, fileTotalPages);
  const pageFiles = visibleFiles.slice((filePageSafe - 1) * FILE_PAGE_SIZE, filePageSafe * FILE_PAGE_SIZE);

  const RESULT_PAGE_SIZE = 10;
  const resultTotalPages = Math.max(1, Math.ceil((lastResults ?? []).length / RESULT_PAGE_SIZE));
  const resultPageSafe = Math.min(resultPage, resultTotalPages);
  const pageResults = (lastResults ?? []).slice((resultPageSafe - 1) * RESULT_PAGE_SIZE, resultPageSafe * RESULT_PAGE_SIZE);

  const removeFile = (id: string) => {
    const target = parsedFiles.find((f) => f.id === id);
    if (target) seenNamesRef.current.delete(target.fileName.toLowerCase());
    setParsedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    seenNamesRef.current.clear();
    setParsedFiles([]);
    setLastResults(null);
    setFilePage(1);
  };

  const retryStudents = () => {
    clearUniversityRawCache();
    void refresh();
  };

  const studentsUnavailable = !studentsLoading && students.length === 0;

  const handleSend = async () => {
    const matched = matchedFiles;
    if (matched.length === 0) {
      toast.error('No matched files to send');
      return;
    }
    const batchSemesters = [...new Set(matched.map((f) => semesterOf(f)).filter((s): s is string => Boolean(s)))];
    const batchSemester = batchSemesters.length === 1 ? batchSemesters[0] : batchSemesters.length > 1 ? 'Multi-Semester' : 'Unassigned';
    setSending(true);
    setLastResults(null);
    setResultPage(1);
    try {
      const res = await fetch('/api/exam-results/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: effectiveYear,
          semester: batchSemester,
          examType,
          files: matched.map((f) => ({
            fileName: f.fileName,
            rollNo: f.rollNo,
            base64: (f.dataUrl ?? '').split(',')[1] || '',
            semester: semesterOf(f) ?? '',
            studentId: studentOf(f)?.studentId ?? '',
            studentUserId: studentOf(f)?.userId ?? '',
            studentEmail: studentOf(f)?.email ?? '',
            studentName: studentOf(f)?.studentName ?? '',
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || 'Batch creation failed');
        return;
      }
      const results: DistributeResult[] = Array.isArray(data?.results) ? data.results : [];
      const failed = results.filter((r) => !r.ok);
      setLastResults(results);
      if (results.length > 0) {
        setSentCount((c) => c + (data.sent ?? 0));
        setParsedFiles((prev) => prev.filter((f) => !results.some((r) => r.ok && r.fileName === f.fileName)));
      }
      const total = data.total ?? results.length;
      const semCount = data.semesters ?? Math.max(1, batchSemesters.length);
      await Promise.all([loadBatches(), loadHistory()]);
      if (failed.length > 0) {
        toast.error(`Processed ${data.succeeded ?? 0}/${total} exam results (${failed.length} failed) — see details`);
      } else {
        toast.success(`Successfully processed ${data.succeeded ?? 0}/${total} exam results across ${semCount} semester${semCount === 1 ? '' : 's'}`);
      }
    } catch {
      toast.error('Network error — could not reach the server');
    } finally {
      setSending(false);
    }
  };

  const runBatchAction = async (batch: ExamBatchRow, action: 'publish' | 'archive' | 'unarchive') => {
    try {
      const res = await fetch(`/api/exam-results/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || 'Action failed');
        return;
      }
      if (action === 'publish') {
        toast.success(`Batch published — ${data.notified ?? 0} students notified`);
      } else if (action === 'archive') {
        toast.success('Batch archived — results hidden from students');
      } else {
        toast.success('Batch restored — results visible to students again');
      }
      void loadBatches();
      void loadHistory();
    } catch {
      toast.error('Network error — could not reach the server');
    }
  };

  const deleteBatch = async (batch: ExamBatchRow) => {
    if (!window.confirm(`Delete batch "${batch.exam_type} • ${batch.semester} • ${batch.academic_year}" and its ${batch.total_files} files? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/exam-results/batches/${batch.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || 'Delete failed');
        return;
      }
      toast.success(`Batch deleted — ${data.deleted ?? 0} files removed`);
      if (historyBatch === batch.id) setHistoryBatch('all');
      void loadBatches();
      void loadHistory();
    } catch {
      toast.error('Network error — could not reach the server');
    }
  };

  const viewBatchDetails = (batch: ExamBatchRow) => {
    setHistorySearch('');
    setHistorySemester('ALL');
    setHistoryExamType('ALL');
    setHistoryBatch(batch.id);
    setHistoryPage(1);
    setTab('history');
  };

  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));
  const historyPageSafe = Math.min(historyPage, historyTotalPages);

  const downloadHref = (r: HistoryRow) =>
    `${r.file_url}${r.file_url.includes('?') ? '&' : '?'}download=${encodeURIComponent(r.file_name)}`;

  const displayName = (r: HistoryRow) => r.student_name ?? r.recipient_email.split('@')[0];

  const historyFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (historySemester !== 'ALL') parts.push(historySemester);
    if (historyExamType !== 'ALL') parts.push(historyExamType);
    if (historySearch.trim()) parts.push(`"${historySearch.trim()}"`);
    return parts.length > 0 ? ` for ${parts.join(' • ')}` : '';
  }, [historySearch, historySemester, historyExamType]);

  const resetHistoryFilters = () => {
    setHistorySearch('');
    setHistorySemester('ALL');
    setHistoryExamType('ALL');
    setHistoryBatch('all');
    setHistoryPage(1);
  };

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 50%, var(--primary-darker) 100%)', borderRadius: 'var(--radius-xl)', padding: '26px 32px', color: '#fff', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Exam Results</h1>
          <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: 13.5, fontWeight: 400 }}>Upload, batch, publish & audit student results</p>
        </div>
        <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{sentCount}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>TOTAL SENT</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--surface)', flexWrap: 'wrap' }}>
        {([
          { id: 'upload', label: 'Upload & Send', icon: Upload },
          { id: 'batches', label: 'Result Batches', icon: Layers },
          { id: 'history', label: 'Sent History', icon: History },
        ] as Array<{ id: TabId; label: string; icon: typeof Upload }>).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2"
            style={{
              padding: '12px 16px', fontSize: 13, fontWeight: 600,
              color: tab === t.id ? 'var(--primary)' : 'var(--text-light)',
              cursor: 'pointer',
              borderBottom: tab === t.id ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <t.icon size={14} />
            {t.label}
            {t.id === 'batches' && batches && batches.length > 0 && (
              <span className="badge badge-sm" style={{ background: 'var(--divider-soft)', color: 'var(--text-light)', border: 'none', fontSize: 10.5 }}>{batches.length}</span>
            )}
            {t.id === 'history' && (
              <span className="badge badge-sm" style={{ background: 'var(--divider-soft)', color: 'var(--text-light)', border: 'none', fontSize: 10.5 }}>{historyTotal}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
          <div>
            <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={16} /> Upload PDFs
                </div>
                {parsedFiles.length > 0 && (
                  <button onClick={clearAll} style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}>
                    Clear all
                  </button>
                )}
              </div>
              <div style={{ padding: '16px 22px' }}>
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(Array.from(e.dataTransfer.files)); }}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--secondary)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '42px 24px',
                    textAlign: 'center',
                    background: dragOver ? 'rgba(14,165,233,0.06)' : 'var(--secondary-lighter)',
                    cursor: 'pointer',
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files) void handleFiles(Array.from(e.target.files)); e.target.value = ''; }}
                  />
                  <div style={{ fontSize: 36, color: 'var(--text-lighter)', marginBottom: 10 }}>
                    <Upload size={36} style={{ display: 'inline' }} />
                  </div>
                  <h4 style={{ fontSize: 15, color: 'var(--accent)', marginBottom: 5 }}>
                    Drag & drop PDFs here or <span style={{ color: 'var(--primary)' }}>browse files</span>
                  </h4>
                  <p style={{ fontSize: 12.5, color: 'var(--text-light)' }}>
                    Filename format: <code style={{ background: 'var(--divider-soft)', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>Student Name(UCSTGO-XXXX).pdf</code> — multiple selection supported
                  </p>
                </div>

                {parsedFiles.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 12 }}>
                      {filterOptions.map((opt) => {
                        const count = opt.id === 'all' ? parsedFiles.length : opt.id === 'matched' ? matchedCount : unmatchedCount;
                        const active = filter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => { setFilter(opt.id); setFilePage(1); }}
                            className="flex items-center gap-1.5"
                            style={{
                              padding: '5px 12px',
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--surface-border)',
                              background: active ? 'rgba(14,165,233,0.1)' : 'transparent',
                              color: active ? 'var(--primary)' : 'var(--text-light)',
                            }}
                          >
                            {opt.id === 'all' && <Filter size={12} />}
                            {opt.label}
                            <span className="badge badge-sm" style={{ background: 'var(--divider-soft)', color: 'var(--text-light)', border: 'none', fontSize: 10.5 }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="overflow-x-auto">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['File Name', 'Extracted Roll No', 'Matched Student', 'Detected Semester', 'Match Status', ''].map((h) => (
                              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 700, letterSpacing: '0.5px', borderBottom: '1.5px solid var(--secondary)', backgroundColor: 'var(--secondary-lighter)' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pageFiles.map((f) => {
                            const student = studentOf(f);
                            const matched = Boolean(student && f.rollNo);
                            return (
                              <tr key={f.id} className="hover:[&>td]:bg-[var(--divider-soft)]">
                                <td style={{ padding: '12px 14px', fontSize: 13.5, borderBottom: '1px solid var(--divider)', color: 'var(--text)' }}>
                                  <span className="flex items-center gap-2">
                                    <FileText size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                    <span className="truncate max-w-[220px]">{f.fileName}</span>
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px', fontSize: 13.5, borderBottom: '1px solid var(--divider)' }}>
                                  {f.rollNo ? (
                                    <code style={{ background: 'var(--divider-soft)', padding: '3px 8px', borderRadius: 6, fontSize: 12.5, fontWeight: 600 }}>{f.rollNo}</code>
                                  ) : (
                                    <span style={{ color: 'var(--text-lighter)', fontSize: 12.5 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 14px', fontSize: 13.5, borderBottom: '1px solid var(--divider)' }}>
                                  {student ? (
                                    <span className="flex items-center gap-2.5">
                                      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
                                        {initialsOf(student.studentName)}
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block truncate font-semibold" style={{ color: 'var(--accent)', maxWidth: 160 }}>{student.studentName}</span>
                                        <span className="block truncate text-xs" style={{ color: 'var(--text-lighter)', maxWidth: 200 }}>{student.email}</span>
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1.5" style={{ color: studentsUnavailable ? 'var(--warning)' : 'var(--danger)', fontSize: 13 }}>
                                      <FileWarning size={14} /> {studentsUnavailable ? 'Records unavailable' : 'Student not found'}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--divider)' }}>
                                  {semesterOf(f) ? (
                                    <span className="min-w-0">
                                      <span className="badge badge-sm" style={{ background: 'rgba(14,165,233,0.12)', color: 'var(--primary)', border: 'none', fontWeight: 700, marginBottom: 4 }}>
                                        {semesterOf(f)}
                                      </span>
                                      <span className="block truncate text-xs" style={{ color: 'var(--text-lighter)', maxWidth: 220, fontFamily: 'monospace' }} title={storagePathOf(f)}>{storagePathOf(f)}</span>
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-lighter)', fontSize: 12.5 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--divider)' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', background: matched ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: matched ? '#166534' : '#b91c1c' }}>
                                    {matched ? <Check size={11} /> : <X size={11} />}
                                    {matched ? 'Matched' : 'Unmatched'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--divider)', textAlign: 'right' }}>
                                  <button onClick={() => removeFile(f.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-lighter)' }}>
                                    <X size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {visibleFiles.length === 0 && (
                            <tr>
                              <td colSpan={6} style={{ padding: '22px', textAlign: 'center', fontSize: 13, color: 'var(--text-lighter)' }}>
                                No {filter === 'all' ? '' : filter} files
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {visibleFiles.length > FILE_PAGE_SIZE && (
                        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--divider)' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                            {visibleFiles.length} file{visibleFiles.length > 1 ? 's' : ''} • Page {filePageSafe} of {fileTotalPages}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setFilePage((p) => Math.max(1, p - 1))} disabled={filePageSafe <= 1} className="btn btn-xs btn-ghost" style={{ border: '1.5px solid var(--surface-border)', opacity: filePageSafe <= 1 ? 0.4 : 1 }}>
                              Prev
                            </button>
                            <button onClick={() => setFilePage((p) => Math.min(fileTotalPages, p + 1))} disabled={filePageSafe >= fileTotalPages} className="btn btn-xs btn-ghost" style={{ border: '1.5px solid var(--surface-border)', opacity: filePageSafe >= fileTotalPages ? 0.4 : 1 }}>
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Settings size={16} /> Batch Settings
                </div>
              </div>
              <div style={{ padding: '16px 22px' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Exam Type</label>
                  <select value={examType} onChange={(e) => setExamType(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}>
                    {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Academic Year</label>
                  <select value={effectiveYear} onChange={(e) => setYear(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}>
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Semester (Auto-Detect)</label>
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: semesterCounts.length > 0 ? 8 : 0 }}>
                      <Sparkles size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>Auto-Detect from Matched Students</span>
                    </div>
                    {semesterCounts.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          {semesterCounts.map(([sem, count]) => (
                            <span key={sem} className="badge badge-sm" style={{ background: 'rgba(14,165,233,0.12)', color: 'var(--primary)', border: 'none', fontWeight: 700 }}>
                              {sem} • {count} file{count > 1 ? 's' : ''}
                            </span>
                          ))}
                        </div>
                        {semesterCounts.length > 1 && (
                          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--warning)', lineHeight: 1.4 }}>
                            Multi-Semester batch — each file is saved under its matched student semester.
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 12.5, color: 'var(--text-light)' }}>
                        No matched files yet — semesters are auto-read from student profile records.
                      </div>
                    )}
                  </div>
                </div>

                {studentsLoading && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-light)', marginBottom: 12 }}>Loading student records…</div>
                )}
                {!studentsLoading && students.length === 0 && (
                  <div className="flex items-center justify-between gap-2 flex-wrap" style={{ fontSize: 12.5, color: 'var(--warning)', marginBottom: 12, lineHeight: 1.45 }}>
                    <span>Student records could not be loaded — files will show as Unmatched until they load.</span>
                    <button onClick={retryStudents} className="btn btn-xs" style={{ border: '1.5px solid var(--surface-border)' }}>
                      Retry
                    </button>
                  </div>
                )}

                <button
                  onClick={() => void handleSend()}
                  disabled={sending || matchedCount === 0 || studentsUnavailable}
                  className="btn w-full border-none text-white gap-2"
                  style={{
                    background: 'linear-gradient(var(--primary), var(--primary-dark))',
                    opacity: sending || matchedCount === 0 || studentsUnavailable ? 0.55 : 1,
                  }}
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {sending ? 'Creating batch…' : `Create Batch (${matchedCount})`}
                </button>

                {lastResults && lastResults.length > 0 && (
                  <div style={{ marginTop: 14, fontSize: 12.5 }}>
                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                        {lastResults.filter((r) => r.ok).length} uploaded • {lastResults.filter((r) => !r.ok).length} failed
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-lighter)' }}>
                        Showing {pageResults.length} of {lastResults.length}
                      </span>
                    </div>
                    {pageResults.map((r) => (
                      <div key={r.fileName} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid var(--divider)' }}>
                        {r.ok
                          ? <Check size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                          : <X size={13} style={{ color: '#dc2626', flexShrink: 0 }} />}
                        <span className="truncate" style={{ color: 'var(--text)' }}>{r.fileName}</span>
                        <span style={{ marginLeft: 'auto', color: r.ok ? '#166534' : '#b91c1c', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {r.ok ? 'Uploaded' : r.error ?? 'Failed'}
                        </span>
                      </div>
                    ))}
                    {lastResults.length > RESULT_PAGE_SIZE && (
                      <div className="flex items-center justify-between pt-2">
                        <span style={{ fontSize: 11, color: 'var(--text-lighter)' }}>Page {resultPageSafe} of {resultTotalPages}</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setResultPage((p) => Math.max(1, p - 1))} disabled={resultPageSafe <= 1} className="btn btn-xs btn-ghost" style={{ border: '1.5px solid var(--surface-border)', opacity: resultPageSafe <= 1 ? 0.4 : 1 }}>
                            Prev
                          </button>
                          <button onClick={() => setResultPage((p) => Math.min(resultTotalPages, p + 1))} disabled={resultPageSafe >= resultTotalPages} className="btn btn-xs btn-ghost" style={{ border: '1.5px solid var(--surface-border)', opacity: resultPageSafe >= resultTotalPages ? 0.4 : 1 }}>
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'batches' && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} /> Result Batches
            </div>
            {batches && batches.length > 0 && (
              <span className="badge badge-primary badge-sm">{batches.length}</span>
            )}
          </div>
          {batches === null && (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
              <Loader2 size={20} className="animate-spin mx-auto mb-2" /> Loading batches…
            </div>
          )}
          {batches !== null && batches.length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
              No batches yet — upload files in the Upload & Send tab to create one.
            </div>
          )}
          {batches && batches.length > 0 && (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Exam Type', 'Semester', 'Academic Year', 'Total Files', 'Status', 'Created', 'Actions'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 700, letterSpacing: '0.5px', borderBottom: '1.5px solid var(--secondary)', backgroundColor: 'var(--secondary-lighter)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:[&>td]:bg-[var(--divider-soft)]">
                      <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>
                        <span className="flex items-center gap-2 font-semibold" style={{ fontSize: 13.5, color: 'var(--accent)' }}>
                          <GraduationCap size={15} style={{ color: 'var(--primary)' }} />
                          {b.exam_type}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)', fontSize: 13.5 }}>{b.semester}</td>
                      <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)', fontSize: 13.5 }}>{b.academic_year}</td>
                      <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>
                        <span className="badge badge-sm" style={{ background: 'var(--divider-soft)', color: 'var(--text-light)', border: 'none', fontWeight: 700 }}>{b.total_files}</span>
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>{statusBadge(b.status)}</td>
                      <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)', fontSize: 12.5, color: 'var(--text-light)' }}>
                        {new Date(b.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {b.status === 'ARCHIVED' ? (
                            <button onClick={() => void runBatchAction(b, 'unarchive')} className="btn btn-primary btn-xs gap-1.5 border-none text-white" title="Restore batch — results visible to students again">
                              <Rocket size={12} /> Unarchive
                            </button>
                          ) : (
                            <button onClick={() => void runBatchAction(b, 'publish')} className="btn btn-success btn-xs gap-1.5 border-none text-white" title={b.status === 'PUBLISHED' ? 'Send a new notification to all students' : 'Publish Batch — notifies all students'}>
                              <Rocket size={12} /> {b.status === 'PUBLISHED' ? 'Notify Again' : 'Publish'}
                            </button>
                          )}
                          <button onClick={() => viewBatchDetails(b)} className="btn btn-primary btn-xs gap-1.5 border-none text-white">
                            <Eye size={12} /> View Details
                          </button>
                          {b.status !== 'ARCHIVED' && (
                            <button onClick={() => void runBatchAction(b, 'archive')} className="btn btn-ghost btn-xs gap-1.5" style={{ border: '1.5px solid var(--surface-border)' }}>
                              <Archive size={12} /> Archive
                            </button>
                          )}
                          <button onClick={() => void deleteBatch(b)} className="btn btn-ghost btn-xs gap-1.5" style={{ border: '1.5px solid var(--surface-border)', color: 'var(--danger)' }}>
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={16} /> Sent History
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={historyBatch} onChange={(e) => { setHistoryBatch(e.target.value); setHistoryPage(1); }} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 12.5, color: 'var(--text)', maxWidth: 280 }}>
                <option value="all">All batches</option>
                {batchOptions.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
              <select value={historyPageSize} onChange={(e) => { setHistoryPageSize(Number(e.target.value)); setHistoryPage(1); }} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 12.5, color: 'var(--text)' }}>
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n} rows / page</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px', borderBottom: '1px solid var(--surface)', flexWrap: 'wrap' }}>
              <div className="flex items-center gap-2" style={{ flex: '1 1 240px', maxWidth: 340 }}>
                <Search size={15} style={{ color: 'var(--text-lighter)', flexShrink: 0 }} />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                  placeholder="Search by roll no or student name…"
                  className="input input-sm"
                  style={{ width: '100%', fontSize: 12.5, background: 'var(--secondary-lighter)', borderColor: 'var(--secondary)' }}
                />
              </div>
              <select value={historySemester} onChange={(e) => { setHistorySemester(e.target.value); setHistoryPage(1); }} className="select select-sm" style={{ fontSize: 12.5, color: 'var(--text)', background: 'var(--secondary-lighter)', borderColor: 'var(--secondary)' }}>
                <option value="ALL">All Semesters</option>
                {HISTORY_SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={historyExamType} onChange={(e) => { setHistoryExamType(e.target.value); setHistoryPage(1); }} className="select select-sm" style={{ fontSize: 12.5, color: 'var(--text)', background: 'var(--secondary-lighter)', borderColor: 'var(--secondary)' }}>
                <option value="ALL">All Exam Types</option>
                {HISTORY_EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={resetHistoryFilters}
                disabled={!historySearch && historySemester === 'ALL' && historyExamType === 'ALL' && historyBatch === 'all'}
                className="btn btn-ghost btn-sm gap-1.5"
                style={{ border: '1.5px solid var(--surface-border)', opacity: !historySearch && historySemester === 'ALL' && historyExamType === 'ALL' && historyBatch === 'all' ? 0.45 : 1 }}
              >
                <RotateCcw size={13} /> Reset Filters
              </button>
              <span className="badge badge-ghost badge-sm" style={{ background: 'var(--divider-soft)', color: 'var(--text)', border: 'none', fontSize: 11.5, fontWeight: 700, padding: '7px 12px' }}>
                Showing {historyTotal} result{historyTotal === 1 ? '' : 's'}{historyFilterLabel}
              </span>
            </div>
          {history === null && (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
              <Loader2 size={20} className="animate-spin mx-auto mb-2" /> Loading history…
            </div>
          )}
          {history !== null && history.length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
              {historyFilterLabel ? 'No results match the current filters.' : 'No sent results yet.'}
            </div>
          )}
          {history && history.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Uploaded At', 'Student', 'Roll No', 'Batch', 'PDF File', 'Actions'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 700, letterSpacing: '0.5px', borderBottom: '1.5px solid var(--secondary)', backgroundColor: 'var(--secondary-lighter)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id} className="hover:[&>td]:bg-[var(--divider-soft)]">
                        <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--divider)', fontSize: 12.5, color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                          {new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--divider)' }}>
                          <span className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
                              {initialsOf(displayName(r))}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold" style={{ color: 'var(--accent)', maxWidth: 180 }}>{displayName(r)}</span>
                              <span className="block truncate text-xs" style={{ color: 'var(--text-lighter)', maxWidth: 200 }}>{r.recipient_email}</span>
                            </span>
                          </span>
                        </td>
                        <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--divider)' }}>
                          <code style={{ background: 'var(--divider-soft)', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{r.roll_number}</code>
                        </td>
                        <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--divider)', fontSize: 12.5 }}>
                          {r.batch_id && batchLabel.has(r.batch_id) ? (
                            <span className="flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                              <GraduationCap size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span className="truncate" style={{ maxWidth: 200 }}>{batchLabel.get(r.batch_id)}</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-light)' }}>{r.semester} • {r.year}</span>
                          )}
                        </td>
                        <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--divider)', fontSize: 13 }}>
                          <span className="flex items-center gap-1.5 truncate" style={{ maxWidth: 220 }}>
                            <FileText size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            {r.file_name}
                          </span>
                        </td>
                        <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--divider)' }}>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setViewer(r)} className="btn btn-primary btn-xs gap-1.5 border-none text-white">
                              <Eye size={12} /> Preview
                            </button>
                            <a href={downloadHref(r)} download={r.file_name} className="btn btn-ghost btn-xs gap-1.5" style={{ border: '1.5px solid var(--surface-border)' }}>
                              <Download size={12} /> Download
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--divider)', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                  {historyTotal} record{historyTotal === 1 ? '' : 's'} • Page {historyPageSafe} of {historyTotalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={historyPageSafe <= 1} className="btn btn-xs btn-ghost" style={{ border: '1.5px solid var(--surface-border)', opacity: historyPageSafe <= 1 ? 0.4 : 1 }}>
                    Previous
                  </button>
                  <button onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))} disabled={historyPageSafe >= historyTotalPages} className="btn btn-xs btn-ghost" style={{ border: '1.5px solid var(--surface-border)', opacity: historyPageSafe >= historyTotalPages ? 0.4 : 1 }}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {viewer && createPortal(
        <AnimatePresence>
          <motion.dialog
            open
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal modal-open z-[999] p-4 border-none"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
            onClick={() => setViewer(null)}
            onCancel={(e) => { e.preventDefault(); setViewer(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="w-[94vw] max-w-3xl bg-base-100 rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff' }}>
                  <FileText size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold text-sm" style={{ color: 'var(--accent)' }}>{viewer.file_name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
                    {displayName(viewer)} • {viewer.roll_number} • {viewer.semester} • {viewer.year}
                  </div>
                </div>
                <button onClick={() => setViewer(null)} className="btn btn-ghost btn-circle btn-sm" title="Close">
                  <X size={16} />
                </button>
              </div>
              <iframe src={viewer.file_url} title={viewer.file_name} className="w-full" style={{ height: '68vh', border: 'none', background: '#fff' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--surface)' }}>
                <a href={downloadHref(viewer)} download={viewer.file_name} className="btn btn-primary gap-1.5 border-none text-white" style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}>
                  <Download size={15} /> Download PDF
                </a>
                <button onClick={() => setViewer(null)} className="btn btn-ghost">Close</button>
              </div>
            </motion.div>
          </motion.dialog>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
