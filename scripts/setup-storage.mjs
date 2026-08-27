// Creates the public storage buckets the UI expects.
// Run:  node scripts/setup-storage.mjs
// Needs network access to *.supabase.co (Cloudflare) — currently blocked on
// this machine, so run it from a hotspot/VPN if it times out here.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hzjxcogeqnckadudxvqb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKETS = ['post-media', 'activity-media', 'event-images'];

for (const id of BUCKETS) {
  const res = await fetch(`${URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, name: id, public: true, fileSizeLimit: 52428800 }),
  });
  const body = await res.text();
  console.log(`bucket ${id}: ${res.status} ${body.slice(0, 120)}`);
}
