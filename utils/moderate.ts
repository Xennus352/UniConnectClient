import 'server-only';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ModerationResult {
  safe: boolean;
  reason: string | null;
}

const PROMPT = `You are a university community content moderator. Classify the post as SAFE or FLAG. 
If FLAG, briefly state the single primary reason (e.g. harassment, spam, hate speech, explicit, prohibited goods, impersonation). 
Return ONLY: SAFE  or  FLAG: <reason>`;

export async function moderateContent(text: string, imageB64?: string | null): Promise<ModerationResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { safe: true, reason: null };

  const content: any[] = [{ type: 'text', text: text || '' }];
  if (imageB64 && imageB64.startsWith('data:')) {
    content.unshift({ type: 'image_url', image_url: { url: imageB64 } });
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': 'UniConnect Moderation',
      'HTTP-Referer': 'https://uniconnect.app',
    },
    body: JSON.stringify({
      model: 'google/gemma-3-27b-it:free',
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content },
      ],
      max_tokens: 64,
    }),
  });

  if (!res.ok) return { safe: true, reason: null };
  const data = await res.json().catch(() => ({}));
  const out = (data?.choices?.[0]?.message?.content || '').trim();
  if (/^FLAG:/i.test(out)) {
    return { safe: false, reason: out.replace(/^FLAG:\s*/i, '').slice(0, 200) };
  }
  return { safe: true, reason: null };
}
