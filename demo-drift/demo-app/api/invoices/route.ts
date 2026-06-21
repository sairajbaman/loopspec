// api/invoices/route.ts
// DELIBERATELY BROKEN: Missing validation, missing error handling, missing response types

import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Missing: input validation with Zod
  // Missing: try/catch error handling
  // Missing: typed response

  const { data } = await supabase.from('invoices').select('*');
  return new Response(JSON.stringify(data));
}

export async function POST(request: Request) {
  const body = await request.json();

  // Missing: Zod validation of body
  // Missing: try/catch
  // Missing: auth check

  return new Response(JSON.stringify({ ok: true }));
}
