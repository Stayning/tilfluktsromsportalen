import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Carries an HTTP status so the top-level handler can translate to a response.
export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code)
  }
}

export interface AdminContext {
  callerId: string
  adminClient: SupabaseClient
  callerClient: SupabaseClient
}

// Verify the request is from an authenticated admin.
// adminClient uses the service role (bypasses RLS); callerClient carries the
// caller's JWT so RLS-scoped writes run as the admin (needed for reassignment).
export async function requireAdmin(req: Request): Promise<AdminContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, 'no_authorization')

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const adminClient = createClient(url, serviceKey)
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await callerClient.auth.getUser()
  if (error || !user) throw new HttpError(401, 'invalid_token')

  const { data: adminRow, error: adminErr } = await adminClient
    .from('app_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (adminErr) throw new HttpError(500, 'admin_check_failed')
  if (!adminRow) throw new HttpError(403, 'not_admin')

  return { callerId: user.id, adminClient, callerClient }
}

// Total number of admins — used by last-admin guards.
export async function countAdmins(adminClient: SupabaseClient): Promise<number> {
  const { count, error } = await adminClient
    .from('app_admins')
    .select('user_id', { count: 'exact', head: true })
  if (error) throw new HttpError(500, 'admin_count_failed')
  return count ?? 0
}
