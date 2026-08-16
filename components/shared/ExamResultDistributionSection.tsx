'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload, Settings, FileText, GraduationCap, Send, Loader2,
  X, Check, FileWarning, Filter,
} from 'lucide-react';
import { apiFetch, type StudentRecord, type AcademicTermRecord, type ResultBatchRecord } from './api';
import { useUniversityData } from './useUniversityData';
import { useUniversityRaw, clearUniversityRawCache } from './useUniversityPeople';
import DataTable from './DataTable';
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

const semesterLabel = (n: number) =>
  `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');

const filterOptions = [
  { id: 'all', label: 'All' },
  { id: 'matched', label: 'Matched' },
  { id: 'unmatched', label: 'Unmatched' },
] as const;

type FilterId = (typeof filterOptions)[number]['id'];

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
  const [examTab, setExamTab] = useState('Upload');
  const [filePage, setFilePage] = useState(1);
  const [resultPage, setResultPage] = useState(1);

  const { data: terms } = useUniversityData<AcademicTermRecord[]>(
    useCallback(() => apiFetch<AcademicTermRecord[]>('/api/terms'), [])
  );

  const yearOptions = useMemo(() => {
    const years = [...new Set((terms ?? []).map((t) => t.academicYear))].sort((a, b) => b - a);
    return years.length > 0 ? years.map((y) => String(y)) : ['2025-2026', '2024-2025'];
  }, [terms]);

  const [year, setYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('');

  const effectiveYear = year || yearOptions[0] || '2025-2026';

  const semesterOptions = useMemo(() => {
    const ts = (terms ?? []).filter((t) => String(t.academicYear) === effectiveYear);
    return ts.length > 0
      ? ts.map((t, i) => ({
          value: `Semester ${i + 1}`,
          label: `Semester ${i + 1}${t.status === 'ACTIVE' ? ' (Active)' : ''}`,
        }))
      : [{ value: 'Semester 1', label: 'Semester 1' }];
  }, [terms, effectiveYear]);

  const effectiveSemester = useMemo(() => {
    if (semester) return semester;
    const ts = (terms ?? []).filter((t) => String(t.academicYear) === effectiveYear);
    if (ts.length === 0) return 'Semester 1';
    const activeIdx = ts.findIndex((t) => t.status === 'ACTIVE');
    return `Semester ${(activeIdx >= 0 ? activeIdx : 0) + 1}`;
  }, [semester, terms, effectiveYear]);

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

  const studentOf = (f: ParsedFile): StudentRecord | null =>
    f.rollNo ? studentByRoll.get(f.rollNo) ?? null : null;

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
    setSending(true);
    setLastResults(null);
    setResultPage(1);
    try {
      const res = await fetch('/api/exam-results/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: effectiveYear,
          semester: effectiveSemester,
          files: matched.map((f) => ({
            fileName: f.fileName,
            rollNo: f.rollNo,
            base64: (f.dataUrl ?? '').split(',')[1] || '',
            studentUserId: studentOf(f)?.userId ?? '',
            studentEmail: studentOf(f)?.email ?? '',
            studentName: studentOf(f)?.studentName ?? '',
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || 'Distribution failed');
        return;
      }
      const results: DistributeResult[] = Array.isArray(data?.results) ? data.results : [];
      const failed = results.filter((r) => !r.ok);
      setLastResults(results);
      if (results.length > 0) {
        setSentCount((c) => c + (data.sent ?? 0));
        setParsedFiles((prev) => prev.filter((f) => !results.some((r) => r.ok && r.fileName === f.fileName)));
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} file${failed.length > 1 ? 's' : ''} failed — see details`);
      } else {
        toast.success(`${data.sent ?? 0} exam result${(data.sent ?? 0) === 1 ? '' : 's'} delivered to students`);
      }
    } catch {
      toast.error('Network error — could not reach the server');
    } finally {
      setSending(false);
    }
  };

  const { data: batchesData, loading, error } = useUniversityData<ExamBatchRow[]>(
    useCallback(() => apiFetch<ResultBatchRecord[]>('/api/result-batches').then((batches) =>
      batches.map((b) => ({
        examType: b.examTypeName,
        semester: semesterLabel(b.semesterNo),
        academicYear: String(b.academicYear),
        totalFiles: String(b.totalFiles),
        status: b.status,
      }))
    ), []),
  );
  const batches = batchesData ?? [];

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 50%, var(--primary-darker) 100%)', borderRadius: 'var(--radius-xl)', padding: '26px 32px', color: '#fff', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Exam Results</h1>
          <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: 13.5, fontWeight: 400 }}>Upload, match & deliver to students</p>
        </div>
        <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{sentCount}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>SENT</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--surface)' }}>
        {['Upload', 'Batches'].map((t) => (
          <button key={t} onClick={() => setExamTab(t)} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: examTab === t ? 'var(--primary)' : 'var(--text-light)', cursor: 'pointer', borderBottom: examTab === t ? '2.5px solid var(--primary)' : '2.5px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            {t === 'Upload' && <Upload size={14} />}{t === 'Batches' && <GraduationCap size={14} />}{t}
          </button>
        ))}
      </div>

      {examTab === 'Upload' && (
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
                            {['File Name', 'Extracted Roll No', 'Matched Student', 'Match Status', ''].map((h) => (
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
                              <td colSpan={5} style={{ padding: '22px', textAlign: 'center', fontSize: 13, color: 'var(--text-lighter)' }}>
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
                  <Settings size={16} /> Settings
                </div>
              </div>
              <div style={{ padding: '16px 22px' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Academic Year</label>
                  <select value={effectiveYear} onChange={(e) => { setYear(e.target.value); setSemester(''); }} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}>
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Semester</label>
                  <select value={effectiveSemester} onChange={(e) => setSemester(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}>
                    {semesterOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16, fontSize: 12.5, color: 'var(--text-light)', lineHeight: 1.5 }}>
                  Files are stored under <code style={{ background: 'var(--divider-soft)', padding: '2px 6px', borderRadius: 6, fontSize: 11.5 }}>{effectiveYear}/{effectiveSemester}/UCSTGO-XXXX_exam_result.pdf</code> and delivered to each student&apos;s Exam Results page in real time.
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
                  {sending ? 'Sending…' : `Send Exam Results (${matchedCount})`}
                </button>

                {lastResults && lastResults.length > 0 && (
                  <div style={{ marginTop: 14, fontSize: 12.5 }}>
                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                        {lastResults.filter((r) => r.ok).length} sent • {lastResults.filter((r) => !r.ok).length} failed
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
                          {r.ok ? 'Sent' : r.error ?? 'Failed'}
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

      {examTab === 'Batches' && (
        <>
          {loading && !batchesData && <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Loading…</div>}
          {error && !batchesData && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
          {!loading && !error && batches.length === 0 && (
            <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
              No result batches yet
            </div>
          )}
          {batches.length > 0 && (
            <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} /> Result Batches
                </div>
              </div>
              <div style={{ padding: '16px 22px' }}>
                <DataTable
                  columns={[
                    { key: 'examType', label: 'Exam Type' },
                    { key: 'semester', label: 'Semester' },
                    { key: 'academicYear', label: 'Academic Year' },
                    { key: 'totalFiles', label: 'Total Files' },
                    { key: 'status', label: 'Status', render: (v: string) => (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', background: v === 'PUBLISHED' || v === 'ready' ? 'rgba(34,197,94,0.15)' : 'rgba(146,64,14,0.15)', color: v === 'PUBLISHED' || v === 'ready' ? '#166534' : '#92400e' }}>{v}</span>
                    )},
                  ]}
                  data={batches}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ExamBatchRow {
  examType: string;
  semester: string;
  academicYear: string;
  totalFiles: string;
  status: string;
}