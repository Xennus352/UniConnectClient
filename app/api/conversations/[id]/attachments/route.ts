import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

const BUCKET = 'chat-attachments';
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 8;
const URL_TTL = 3600;

const ALLOWED_EXT = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  'txt', 'csv', 'zip',
]);

interface ChatAttachment {
  name: string;
  size: number;
  mime: string;
  path: string;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'file';
}

async function getParticipantConv(supabase: SupabaseClient, id: string, email: string) {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !conv) return { conv: null, error: 'Conversation not found' };
  if (!(conv.participant_ids as string[]).includes(email)) {
    return { conv: null, error: 'Not a participant' };
  }
  return { conv, error: null };
}

async function ensureBucket(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.storage.getBucket(BUCKET);
  if (!error) return true;
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_SIZE,
  });
  return !createErr;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { conv, error: pErr } = await getParticipantConv(supabase, id, identity.email);
  if (!conv) return NextResponse.json({ message: pErr }, { status: conv ? 200 : 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: 'Invalid upload' }, { status: 400 });
  }
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ message: 'No files selected' }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ message: `Upload at most ${MAX_FILES} files at once` }, { status: 400 });
  }

  for (const file of files) {
    if (file.size === 0) return NextResponse.json({ message: `${file.name} is empty` }, { status: 400 });
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ message: `${file.name} exceeds the ${MAX_SIZE / 1024 / 1024}MB limit` }, { status: 413 });
    }
    if (!ALLOWED_EXT.has(extOf(file.name))) {
      return NextResponse.json({ message: `${file.name}: unsupported file type` }, { status: 415 });
    }
  }

  if (!(await ensureBucket(supabase))) {
    return NextResponse.json({ message: 'Storage unavailable' }, { status: 500 });
  }

  const uploaded: ChatAttachment[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const objectPath = `${id}/${crypto.randomUUID()}/${crypto.randomUUID()}-${sanitizeName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType: file.type || 'application/octet-stream', cacheControl: '3600', upsert: false });
    if (upErr) {
      await supabase.storage.from(BUCKET).remove(uploaded.map((a) => a.path));
      return NextResponse.json({ message: `Upload failed for ${file.name}: ${upErr.message}` }, { status: 500 });
    }
    uploaded.push({ name: file.name, size: file.size, mime: file.type || 'application/octet-stream', path: objectPath });
  }

  return NextResponse.json({ attachments: uploaded }, { status: 201 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { conv, error: pErr } = await getParticipantConv(supabase, id, identity.email);
  if (!conv) return NextResponse.json({ message: pErr }, { status: 403 });

  let paths: string[] = [];
  try {
    paths = JSON.parse(new URL(request.url).searchParams.get('paths') ?? '[]') as string[];
  } catch {
    return NextResponse.json({ message: 'Invalid paths' }, { status: 400 });
  }
  if (paths.length === 0) return NextResponse.json({ urls: {} });
  if (paths.some((p) => typeof p !== 'string' || !p.startsWith(`${id}/`))) {
    return NextResponse.json({ message: 'Invalid attachment path' }, { status: 400 });
  }

  const urls: Record<string, { url: string; downloadUrl: string }> = {};
  for (const path of paths) {
    const [{ data: a, error: aErr }, { data: b, error: bErr }] = await Promise.all([
      supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL),
      supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL, { download: true }),
    ]);
    if (aErr || bErr || !a || !b) continue;
    urls[path] = { url: a.signedUrl, downloadUrl: b.signedUrl };
  }
  return NextResponse.json({ urls });
}
