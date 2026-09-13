import { corsHeaders, json } from '../_shared/cors.ts'
import { requireAdmin, countAdmins, HttpError } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { callerId, adminClient, callerClient } = await requireAdmin(req)
    const { userId } = (await req.json()) as { userId?: string }
    if (!userId) throw new HttpError(400, 'missing_user_id')
    if (userId === callerId) throw new HttpError(400, 'cannot_delete_self')

    // Last-admin guard: never delete the only remaining admin.
    const { data: targetAdmin } = await adminClient
      .from('app_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (targetAdmin && (await countAdmins(adminClient)) <= 1) {
      throw new HttpError(409, 'last_admin')
    }

    // Reassign authored resources to the deleting admin. Runs through the
    // caller's admin JWT so is_admin() RLS + the protect_shelter_created_by
    // trigger permit changing created_by. Fully completes before the delete,
    // so a mid-way failure leaves the user intact.
    const reassign = async (table: string, column: string): Promise<number> => {
      const { data, error } = await callerClient
        .from(table)
        .update({ [column]: callerId })
        .eq(column, userId)
        .select('*')
      if (error) throw new HttpError(400, `reassign_${table}_failed`)
      return data?.length ?? 0
    }

    const shelters = await reassign('tilfluktsrom', 'created_by')
    const documents = await reassign('tilfluktsrom_documents', 'uploaded_by')
    const invites = await reassign('tilfluktsrom_invites', 'invited_by')
    const memberships = await reassign('tilfluktsrom_members', 'invited_by')

    // Delete the profile row explicitly (service role). Every other reference
    // to this user is now reassigned (created_by, uploaded_by, invited_by) or
    // cascades on this delete (tilfluktsrom_members.user_id and
    // app_admins.user_id are both ON DELETE CASCADE). Doing this before the
    // auth delete means it succeeds whether or not profiles.id -> auth.users
    // is ON DELETE CASCADE (that FK is not defined in the migrations).
    const { error: profileDelErr } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (profileDelErr) throw new HttpError(400, 'delete_profile_failed')

    // Hard-delete the auth identity.
    const { error: delErr } = await adminClient.auth.admin.deleteUser(userId)
    if (delErr) throw new HttpError(400, delErr.message)

    return json({
      ok: true,
      reassigned: { shelters, documents, invites, memberships },
    })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code }, err.status)
    console.error('admin-delete-user error:', err)
    return json({ error: 'internal_error' }, 500)
  }
})
