/**
 * Supabase REST (PostgREST) client for production.
 * In development, routes fall back to better-sqlite3.
 */

function getUrl() { return process.env.SUPABASE_URL || ''; }
function getKey() { return process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''; }


export const isProduction = !!getUrl();

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const url = getUrl();
  const key = getKey();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  return res;
}

/** SELECT rows */
export async function sSelect(table: string, query = ''): Promise<any[]> {
  const res = await rest(`${table}${query ? '?' + query : ''}`);
  return res.json();
}

/** SELECT one row */
export async function sSelectOne(table: string, query: string): Promise<any | null> {
  const res = await rest(`${table}?${query}&limit=1`);
  const data = await res.json();
  return data[0] || null;
}

/** SELECT with exact count */
export async function sSelectCount(table: string, query = ''): Promise<{ data: any[]; count: number }> {
  const res = await rest(`${table}${query ? '?' + query : ''}`, {
    headers: { 'Prefer': 'count=exact' },
  });
  const data = await res.json();
  const range = res.headers.get('content-range') || '*/0';
  const count = parseInt(range.split('/')[1] || '0');
  return { data, count };
}

/** INSERT row(s) */
export async function sInsert(table: string, data: any): Promise<void> {
  await rest(table, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Prefer': 'return=minimal' },
  });
}

/** UPDATE row(s) matching filter */
export async function sUpdate(table: string, filter: string, data: any): Promise<void> {
  await rest(`${table}?${filter}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { 'Prefer': 'return=minimal' },
  });
}

/** DELETE row(s) matching filter */
export async function sDelete(table: string, filter: string): Promise<void> {
  await rest(`${table}?${filter}`, {
    method: 'DELETE',
    headers: { 'Prefer': 'return=minimal' },
  });
}
