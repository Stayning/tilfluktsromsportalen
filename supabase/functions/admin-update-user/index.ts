import { corsHeaders, json } from '../_shared/cors.ts'
import { requireAdmin, countAdmins, HttpError } from '../_shared/admin.ts'

// Pull a human-readable string out of whatever an SDK/DB call handed back.
// Guards against auth-js flattening an error to "{}" (which otherwise reaches
// the client as an opaque `{ "error": "{}" }`).
function errText(e: unknown): string {
  if (e && typeof e === 'object') {
    for (const k of ['message', 'msg', 'error_description', 'details', 'hint', 'code']) {
      const v = (e as Record<string, unknown>)[k]
      if (typeof v === 'string' && v.trim() && v.trim() !== '{}') return v
    }
  }
  if (typeof e === 'string' && e.trim() && e.trim() !== '{}') return e
  return 'unexpected_error'
}

interface UpdateBody {
  userId?: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  email?: string | null
  is_admin?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { adminClient } = await requireAdmin(req)
    const body = (await req.json()) as UpdateBody
    if (!body.userId) throw new HttpError(400, 'missing_user_id')

    const firstName = body.first_name?.trim() || null
    const lastName = body.last_name?.trim() || null
    const phone = body.phone?.trim() || null
    const email = body.email?.trim() || null
    const displayName = [firstName, lastName].filter(Boolean).join(' ')

    // 1. Update the auth identity (phone/email are login credentials).
    const authAttrs: Record<string, unknown> = {}
    const digitsOnly = (s?: string | null) => (s ?? '').replace(/\D/g, '')

    // Only touch phone/email when they actually differ from the current auth
    // identity, so an unrelated edit (e.g. name only) never re-applies a login
    // credential — re-applying trips GoTrue's uniqueness constraint when another
    // account already holds that email/phone.
    let phoneChanged = false
    if (phone || email) {
      const { data: current } = await adminClient.auth.admin.getUserById(body.userId)
      if (phone && digitsOnly(current?.user?.phone) !== digitsOnly(phone)) {
        authAttrs.phone = phone
        authAttrs.phone_confirm = true
        phoneChanged = true
      }
      if (email && (current?.user?.email ?? '') !== email) {
        authAttrs.email = email
        authAttrs.email_confirm = true
      }
    }
    if (displayName) authAttrs.user_metadata = { display_name: displayName }

    if (Object.keys(authAttrs).length > 0) {
      const { error } = await adminClient.auth.admin.updateUserById(
        body.userId,
        authAttrs,
      )
      if (error) {
        // GoTrue can report a duplicate credential opaquely (auth-js may flatten
        // it to "{}"), so log the raw error and return a clear, mapped code.
        console.error('admin-update-user auth update failed:', error)
        if (authAttrs.email) throw new HttpError(409, 'email_in_use')
        if (authAttrs.phone) throw new HttpError(409, 'phone_in_use')
        throw new HttpError(400, errText(error))
      }
    }

    // 2. Mirror into profiles. Only touch phone/email when actually provided,
    //    so a blank field never desyncs the profile from the auth identity.
    const profilePatch: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      full_name: displayName || null,
    }
    if (phone && phoneChanged) profilePatch.phone = phone
    if (email) profilePatch.email = email

    const { error: profileErr } = await adminClient
      .from('profiles')
      .update(profilePatch)
      .eq('id', body.userId)
    if (profileErr) throw new HttpError(400, errText(profileErr))

    // 3. Admin toggle (app_admins), with last-admin guard on demotion.
    if (typeof body.is_admin === 'boolean') {
      const { data: existing } = await adminClient
        .from('app_admins')
        .select('user_id')
        .eq('user_id', body.userId)
        .maybeSingle()
      const currentlyAdmin = !!existing

      if (body.is_admin && !currentlyAdmin) {
        const { error } = await adminClient
          .from('app_admins')
          .insert({ user_id: body.userId })
        if (error) throw new HttpError(400, errText(error))
      } else if (!body.is_admin && currentlyAdmin) {
        if ((await countAdmins(adminClient)) <= 1) {
          throw new HttpError(409, 'last_admin')
        }
        const { error } = await adminClient
          .from('app_admins')
          .delete()
          .eq('user_id', body.userId)
        if (error) throw new HttpError(400, errText(error))
      }
    }

    return json({ ok: true })
  } catch (err) {
    console.error('admin-update-user error:', err)
    if (err instanceof HttpError) return json({ error: err.code }, err.status)
    return json({ error: 'internal_error' }, 500)
  }
})
