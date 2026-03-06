import 'dotenv/config';

export async function deleteWaitlistEntry(email: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test');
  }

  await fetch(
    `${url}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );
}

export async function getWaitlistEntry(email: string): Promise<Record<string, unknown> | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test');
  }

  const res = await fetch(
    `${url}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=*`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );

  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
