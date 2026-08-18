import 'server-only';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 15000;

export type ModerationType = 'text' | 'image' | 'video';

export interface ModerationResult {
  safe: boolean;
  reason: string | null;
}

// One OpenRouter key per model. The user supplies a separate key per model
// (TEXT_MODEL_1_KEY..N, IMAGE_MODEL_1_KEY..N, VIDEO_MODEL_1_KEY..N), so a
// post type picks its own model group and every configured model votes on it.
// Aggregation: if ANY model flags the content, the post is blocked. If a
// model call fails (rate limit, network, invalid model id), that model is
// skipped — content is only blocked on a real flag, never on an error.
interface ModelEntry {
  model: string;
  env: string;
}

const MODEL_GROUPS: Record<ModerationType, ModelEntry[]> = {
  text: [
    { model: 'nemotron-3-ultra-550b', env: 'TEXT_MODEL_1_KEY' },
    { model: 'nemotron-3-super-120b', env: 'TEXT_MODEL_2_KEY' },
    { model: 'llama-3.1-8b-instruct', env: 'OPENROUTER_API_KEY' },
  ],
  image: [
    { model: 'nvidia/llama-3.2-nv-vlm:1', env: 'IMAGE_MODEL_1_KEY' },
    { model: 'google/gemma-3-27b-it', env: 'IMAGE_MODEL_2_KEY' },
    { model: 'google/gemini-2.0-flash-001', env: 'IMAGE_MODEL_3_KEY' },
    { model: 'google/gemini-2.5-flash-preview-04-17', env: 'IMAGE_MODEL_4_KEY' },
  ],
  video: [
    { model: 'nvidia/llama-3.2-nv-vlm:1', env: 'VIDEO_MODEL_1_KEY' },
    { model: 'google/gemma-3-27b-it', env: 'VIDEO_MODEL_2_KEY' },
    { model: 'google/gemini-2.0-flash-001', env: 'VIDEO_MODEL_3_KEY' },
    { model: 'google/gemini-2.5-flash-preview-04-17', env: 'OPENROUTER_API_KEY' },
  ],
};

const PROMPT = `You are a university community content moderator. Classify the post as SAFE or FLAG. 
If FLAG, briefly state the single primary reason (e.g. harassment, spam, hate speech, explicit, prohibited goods, impersonation). 
Return ONLY: SAFE  or  FLAG: <reason>`;

async function callModel(
  model: string,
  key: string,
  text: string,
  imageB64?: string | null
): Promise<{ flagged: boolean; reason?: string } | null> {
  const content: any[] = [{ type: 'text', text: text || '' }];
  if (imageB64 && imageB64.startsWith('data:')) {
    content.unshift({ type: 'image_url', image_url: { url: imageB64 } });
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'UniConnect Moderation',
        'HTTP-Referer': 'https://uniconnect.app',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content },
        ],
        max_tokens: 64,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const out = (data?.choices?.[0]?.message?.content || '').trim();
    if (/^FLAG:/i.test(out)) {
      return { flagged: true, reason: out.replace(/^FLAG:\s*/i, '').slice(0, 200) };
    }
    return { flagged: false };
  } catch {
    return null;
  }
}

export async function moderateContent(
  text: string,
  imageB64?: string | null,
  type: ModerationType = 'text'
): Promise<ModerationResult> {
  const models = MODEL_GROUPS[type];
  const flags: string[] = [];
  let attempted = 0;

  for (const entry of models) {
    const key = process.env[entry.env];
    if (!key) continue;
    attempted += 1;
    const result = await callModel(entry.model, key, text, imageB64);
    if (result?.flagged) flags.push(result.reason || entry.model);
  }

  // No keys configured for this type → allow (never block on config issues).
  if (attempted === 0) return { safe: true, reason: null };
  if (flags.length > 0) {
    return { safe: false, reason: [...new Set(flags)].join('; ') };
  }
  return { safe: true, reason: null };
}
