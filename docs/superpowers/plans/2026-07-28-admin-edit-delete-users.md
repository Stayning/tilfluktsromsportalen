# Admin Edit & Delete Users — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins edit a user's identity (name, phone, email) and admin rights, and hard-delete a user while reassigning everything they authored to the deleting admin.

**Architecture:** Two Supabase Edge Functions (`admin-update-user`, `admin-delete-user`) modeled on the existing `accept-invite` — each verifies the caller's JWT, checks admin status, then acts with the service role. Identity changes use the GoTrue Admin API. Resource reassignment on delete runs through the *caller's* admin JWT so existing `is_admin()` RLS and the `protect_shelter_created_by` trigger permit it. The frontend adds per-row Edit/Delete actions on the existing `/admin/users` directory. **No database migration is required.**

**Tech Stack:** React 18 + TypeScript (Vite), TanStack Query v5, Tailwind, `react-phone-number-input`, Supabase (Deno Edge Functions, GoTrue Admin API, service role).

## Global Constraints

- **No mutation of the live Supabase project.** Deliver migration/function *files*; do not deploy or run privileged ops. The user deploys with `supabase functions deploy admin-update-user admin-delete-user`.
- **No test framework exists** in this repo. Verification is `npm run build` (`tsc -b && vite build`) and `npm run lint` (`eslint .`) plus review. `tsc` only checks `src` (tsconfig.app.json `include: ["src"]`), so edge functions are **not** type-checked locally; `eslint .` **does** lint them (typescript-eslint disables `no-undef`, so Deno globals are fine — keep functions lint-clean: no unused vars, no `any`).
- **Edge functions** mirror `supabase/functions/accept-invite/index.ts`: `jsr:@supabase/supabase-js@2`, CORS headers, `OPTIONS` handling, service-role client from `SUPABASE_SERVICE_ROLE_KEY`, caller client from `SUPABASE_ANON_KEY` + forwarded `Authorization`.
- **Frontend conventions:** hand-rolled Tailwind modals (match `AddToShelterModal` in `UserDirectory.tsx`), TanStack Query `invalidateQueries` (no optimistic updates), feedback via `useToast()` from `@/contexts/ToastContext`, Norwegian UI copy.
- **Commits:** conventional commits; end each commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Work stays on branch `arealmaas/admin-edit-users`; do not push to main.

## File Structure

- Create `supabase/functions/_shared/cors.ts` — CORS headers + `json()` response helper.
- Create `supabase/functions/_shared/admin.ts` — `HttpError`, `requireAdmin(req)`, `countAdmins()`.
- Create `supabase/functions/admin-update-user/index.ts` — identity + profile + admin-toggle update.
- Create `supabase/functions/admin-delete-user/index.ts` — reassign authored resources + hard-delete.
- Modify `src/hooks/useShelters.ts` — add `useUpdateUser`, `useDeleteUser`, `UpdateUserInput`, `DeleteUserResult`, `toInvokeError`.
- Modify `src/pages/UserDirectory.tsx` — per-row Edit/Delete actions, `EditUserModal`, `DeleteUserDialog`, error-copy map.

## Reassignment map (delete)

| Table.column | On delete FK | Action on user delete |
|---|---|---|
| `tilfluktsrom.created_by` | NO ACTION (blocks) | reassign → caller |
| `tilfluktsrom_documents.uploaded_by` | SET NULL | reassign → caller |
| `tilfluktsrom_invites.invited_by` | NO ACTION (blocks) | reassign → caller |
| `tilfluktsrom_members.invited_by` | NO ACTION (blocks) | reassign → caller |
| `tilfluktsrom_members.user_id` | CASCADE | auto-removed by delete |
| `app_admins.user_id` | CASCADE | auto-removed by delete |

`vurdering.utførende` is free text (no FK) — nothing to reassign.

---

### Task 1: Shared edge-function helpers

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/admin.ts`

**Interfaces:**
- Produces: `corsHeaders`, `json(body, status?)`; `class HttpError(status, code)`; `requireAdmin(req): Promise<{ callerId: string; adminClient; callerClient }>`; `countAdmins(adminClient): Promise<number>`.

- [ ] **Step 1: Create `supabase/functions/_shared/cors.ts`**

```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: Create `supabase/functions/_shared/admin.ts`**

```ts
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
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS with no new errors (Deno globals are allowed; ensure no unused vars).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared
git commit -m "feat: shared edge-function admin auth helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `admin-update-user` edge function

**Files:**
- Create: `supabase/functions/admin-update-user/index.ts`

**Interfaces:**
- Consumes: `corsHeaders`, `json` (Task 1); `requireAdmin`, `countAdmins`, `HttpError` (Task 1).
- Produces: HTTP endpoint accepting `{ userId, first_name?, last_name?, phone?, email?, is_admin? }`; returns `{ ok: true }` or `{ error: code }`.

Semantics: blank/absent `phone`/`email` mean **leave the login credential unchanged** (never clears it). Name fields are profile-only and always written.

- [ ] **Step 1: Create `supabase/functions/admin-update-user/index.ts`**

```ts
import { corsHeaders, json } from '../_shared/cors.ts'
import { requireAdmin, countAdmins, HttpError } from '../_shared/admin.ts'

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
    if (phone) {
      authAttrs.phone = phone
      authAttrs.phone_confirm = true
    }
    if (email) {
      authAttrs.email = email
      authAttrs.email_confirm = true
    }
    if (displayName) authAttrs.user_metadata = { display_name: displayName }

    if (Object.keys(authAttrs).length > 0) {
      const { error } = await adminClient.auth.admin.updateUserById(
        body.userId,
        authAttrs,
      )
      if (error) throw new HttpError(400, error.message)
    }

    // 2. Mirror into profiles. Only touch phone/email when actually provided,
    //    so a blank field never desyncs the profile from the auth identity.
    const profilePatch: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      full_name: displayName || null,
    }
    if (phone) profilePatch.phone = phone
    if (email) profilePatch.email = email

    const { error: profileErr } = await adminClient
      .from('profiles')
      .update(profilePatch)
      .eq('id', body.userId)
    if (profileErr) throw new HttpError(400, profileErr.message)

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
        if (error) throw new HttpError(400, error.message)
      } else if (!body.is_admin && currentlyAdmin) {
        if ((await countAdmins(adminClient)) <= 1) {
          throw new HttpError(409, 'last_admin')
        }
        const { error } = await adminClient
          .from('app_admins')
          .delete()
          .eq('user_id', body.userId)
        if (error) throw new HttpError(400, error.message)
      }
    }

    return json({ ok: true })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code }, err.status)
    console.error('admin-update-user error:', err)
    return json({ error: 'internal_error' }, 500)
  }
})
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS (no unused vars, no `any`).

- [ ] **Step 3: Review against the design**

Confirm: caller must be admin (Task 1); `phone_confirm`/`email_confirm` set so corrected credentials work immediately; last-admin demotion blocked. Runtime behavior is verified post-deploy by the user.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-update-user
git commit -m "feat: admin-update-user edge function

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `admin-delete-user` edge function

**Files:**
- Create: `supabase/functions/admin-delete-user/index.ts`

**Interfaces:**
- Consumes: `corsHeaders`, `json`, `requireAdmin`, `countAdmins`, `HttpError` (Tasks 1).
- Produces: endpoint accepting `{ userId }`; returns `{ ok: true, reassigned: { shelters, documents, invites, memberships } }` or `{ error: code }`.

- [ ] **Step 1: Create `supabase/functions/admin-delete-user/index.ts`**

```ts
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

    // Hard-delete the auth user. Cascades profiles -> members.user_id and
    // app_admins.user_id (both ON DELETE CASCADE).
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
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Pre-deploy schema check (read-only, user or Claude)**

Confirm `profiles.id → auth.users(id)` is `ON DELETE CASCADE` (pull live schema read-only, or inspect the dashboard). It is the standard Supabase pattern and consistent with `handle_new_user`. **If it is not cascade**, add one line before `deleteUser`:

```ts
await adminClient.from('profiles').delete().eq('id', userId)
```

(which cascades members/admins off the profile), then delete the auth user.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-delete-user
git commit -m "feat: admin-delete-user edge function with resource reassignment

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Frontend mutation hooks

**Files:**
- Modify: `src/hooks/useShelters.ts` (add at end of file, after `getSignedDocumentUrl`)

**Interfaces:**
- Consumes: `supabase` (already imported), `useMutation`, `useQueryClient` (already imported).
- Produces: `UpdateUserInput`, `DeleteUserResult`, `useUpdateUser()`, `useDeleteUser()`.

- [ ] **Step 1: Add the invoke-error import**

At the top of `src/hooks/useShelters.ts`, add to the existing `@/lib/supabase` usage a named import for the error class. Add this import line near the other imports:

```ts
import { FunctionsHttpError } from '@supabase/supabase-js'
```

- [ ] **Step 2: Append hooks + types at the end of `src/hooks/useShelters.ts`**

```ts
// ============================================================
// User administration (admin only) — backed by edge functions
// ============================================================

export interface UpdateUserInput {
  userId: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  email?: string | null
  is_admin?: boolean
}

export interface DeleteUserResult {
  ok: boolean
  reassigned: {
    shelters: number
    documents: number
    invites: number
    memberships: number
  }
}

// Surface the edge function's `{ error: code }` body as an Error message.
async function toInvokeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body?.error) return new Error(body.error)
    } catch {
      // fall through
    }
  }
  return error instanceof Error ? error : new Error('Ukjent feil')
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: input,
      })
      if (error) throw await toInvokeError(error)
      if (data?.error) throw new Error(data.error)
      return data as { ok: boolean }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      })
      if (error) throw await toInvokeError(error)
      if (data?.error) throw new Error(data.error)
      return data as DeleteUserResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['shelters'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}
```

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS. (Confirms `FunctionsHttpError` is exported by `@supabase/supabase-js` and types line up.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useShelters.ts
git commit -m "feat: useUpdateUser and useDeleteUser hooks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Edit user — modal + row action

**Files:**
- Modify: `src/pages/UserDirectory.tsx`

**Interfaces:**
- Consumes: `useUpdateUser`, `UpdateUserInput` (Task 4); `useAuth` (`@/contexts/AuthContext`); `PhoneInput`, `isValidPhoneNumber` (`react-phone-number-input`); `useToast`.
- Produces: `EditUserModal` component; `editUser` state + "Rediger" button; module-level `friendlyError` used again in Task 6.

- [ ] **Step 1: Add imports** to `src/pages/UserDirectory.tsx`

- Add `Pencil` and `Trash2` to the existing `lucide-react` import.
- Add these imports:

```ts
import { useAuth } from '@/contexts/AuthContext'
import { useUpdateUser } from '@/hooks/useShelters'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
```

- Add `useUpdateUser` to the existing `@/hooks/useShelters` import instead of a duplicate if preferred.

- [ ] **Step 2: Add the error-copy map** at module scope (below the `hasPhone` helper near the top):

```ts
const ERROR_MESSAGES: Record<string, string> = {
  last_admin: 'Kan ikke fjerne den siste administratoren.',
  cannot_delete_self: 'Du kan ikke slette din egen bruker.',
  not_admin: 'Du har ikke tilgang til denne handlingen.',
  missing_user_id: 'Mangler bruker-ID.',
  no_authorization: 'Du må være innlogget.',
  invalid_token: 'Økten er utløpt. Logg inn på nytt.',
}

function friendlyError(message: string): string {
  return ERROR_MESSAGES[message] ?? message
}
```

- [ ] **Step 3: Add state + current-user id** inside `UserDirectory`, next to the existing `addToShelterUser` state:

```ts
const [editUser, setEditUser] = useState<UserWithMemberships | null>(null)
const { user: authUser } = useAuth()
```

- [ ] **Step 4: Add a "Rediger" button to the with-phone table actions cell.**

In the with-phone table, the actions `<td className="px-6 py-4 text-right">` currently holds only the "Legg til i tilfluktsrom" button. Wrap the actions in a flex row and add Rediger before it:

```tsx
<td className="px-6 py-4 text-right">
  <div className="flex items-center justify-end gap-1">
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditUser(user)
      }}
      className="inline-flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
      title="Rediger bruker"
    >
      <Pencil className="w-4 h-4" />
      <span>Rediger</span>
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setAddToShelterUser(user)
      }}
      className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
      title="Legg til i tilfluktsrom"
    >
      <Plus className="w-4 h-4" />
      <span>Legg til i tilfluktsrom</span>
    </button>
  </div>
</td>
```

(The Slett button is added in Task 6 inside this same flex row.)

- [ ] **Step 5: Add an actions column to the without-phone table.**

That table has no actions column. (a) In its `<thead>`, after the "Vilkår godtatt" `<th>`, add:

```tsx
<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
  <span className="sr-only">Handling</span>
</th>
```

(b) In each main `<tr>`, after the "Vilkår godtatt" `<td>`, add an actions cell (mirrors Step 4, minus "Legg til"):

```tsx
<td className="px-6 py-4 text-right">
  <div className="flex items-center justify-end gap-1">
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditUser(user)
      }}
      className="inline-flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
      title="Rediger bruker"
    >
      <Pencil className="w-4 h-4" />
      <span>Rediger</span>
    </button>
  </div>
</td>
```

(c) The expanded membership `<tr>` in this table currently renders 4 columns (`colSpan={2}` + status + lock). Add a trailing empty cell so it spans 5 columns: after the lock-button `<td>`, add `<td className="px-6 py-3" />`.

- [ ] **Step 6: Render the modal.** Next to the existing `addToShelterUser` render at the bottom of the returned JSX:

```tsx
{editUser && (
  <EditUserModal
    user={editUser}
    isSelf={authUser?.id === editUser.id}
    onClose={() => setEditUser(null)}
  />
)}
```

- [ ] **Step 7: Add the `EditUserModal` component** at the end of the file (after `AddToShelterModal`):

```tsx
function EditUserModal({
  user,
  isSelf,
  onClose,
}: {
  user: UserWithMemberships
  isSelf: boolean
  onClose: () => void
}) {
  const [firstName, setFirstName] = useState(user.first_name ?? '')
  const [lastName, setLastName] = useState(user.last_name ?? '')
  const [phone, setPhone] = useState<string | undefined>(user.phone ?? undefined)
  const [email, setEmail] = useState(user.email ?? '')
  const [isAdmin, setIsAdmin] = useState(!!user.is_admin)
  const [error, setError] = useState<string | null>(null)

  const updateUser = useUpdateUser()
  const { showToast } = useToast()
  const { refreshProfile } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (phone && !isValidPhoneNumber(phone)) {
      setError('Ugyldig telefonnummer')
      return
    }

    try {
      await updateUser.mutateAsync({
        userId: user.id,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone?.trim() || null,
        email: email.trim() || null,
        is_admin: isAdmin,
      })
      if (isSelf) await refreshProfile()
      showToast('Bruker oppdatert', 'success')
      onClose()
    } catch (err) {
      const msg = friendlyError((err as Error).message)
      setError(msg)
      showToast(msg, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rediger bruker</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornavn</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Etternavn</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefonnummer</label>
            <PhoneInput
              international
              defaultCountry="NO"
              value={phone}
              onChange={setPhone}
              className="phone-input-container"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="rounded border-gray-300"
            />
            Inspektør (administrator)
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={updateUser.isPending}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {updateUser.isPending ? 'Lagrer...' : 'Lagre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/pages/UserDirectory.tsx
git commit -m "feat: admin edit user modal on user directory

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Delete user — confirm dialog + row action

**Files:**
- Modify: `src/pages/UserDirectory.tsx`

**Interfaces:**
- Consumes: `useDeleteUser`, `DeleteUserResult` (Task 4); `friendlyError`, `authUser` (Task 5); `Trash2` (Task 5 import).
- Produces: `DeleteUserDialog`; `deleteUser` state + "Slett" buttons (hidden on own row).

- [ ] **Step 1: Add state** in `UserDirectory`, next to `editUser`:

```ts
const [deleteUser, setDeleteUser] = useState<UserWithMemberships | null>(null)
```

- [ ] **Step 2: Add `useDeleteUser` import** — add it to the existing `@/hooks/useShelters` import.

- [ ] **Step 3: Add "Slett" buttons.** In BOTH action `<div className="flex ...">` blocks added in Task 5 (with-phone and without-phone tables), append a Slett button that is hidden on the current admin's own row:

```tsx
{authUser?.id !== user.id && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      setDeleteUser(user)
    }}
    className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
    title="Slett bruker"
  >
    <Trash2 className="w-4 h-4" />
    <span>Slett</span>
  </button>
)}
```

- [ ] **Step 4: Render the dialog** next to the `EditUserModal` render:

```tsx
{deleteUser && (
  <DeleteUserDialog user={deleteUser} onClose={() => setDeleteUser(null)} />
)}
```

- [ ] **Step 5: Add the `DeleteUserDialog` component** at the end of the file:

```tsx
function DeleteUserDialog({
  user,
  onClose,
}: {
  user: UserWithMemberships
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const deleteUser = useDeleteUser()
  const { showToast } = useToast()

  const label =
    `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
    user.phone ||
    user.email ||
    'brukeren'

  const handleDelete = async () => {
    setError(null)
    try {
      const result = await deleteUser.mutateAsync(user.id)
      const r = result.reassigned
      const moved = r.shelters + r.documents + r.invites + r.memberships
      showToast(
        moved > 0
          ? `Bruker slettet. ${moved} ressurs(er) overført til deg.`
          : 'Bruker slettet.',
        'success',
      )
      onClose()
    } catch (err) {
      const msg = friendlyError((err as Error).message)
      setError(msg)
      showToast(msg, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Slett bruker</h2>
        <p className="text-sm text-gray-600 mb-1">
          Er du sikker på at du vil slette <strong>{label}</strong>?
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Dette fjerner brukeren permanent. Tilfluktsrom, dokumenter og
          invitasjoner brukeren har opprettet blir overført til deg.
        </p>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteUser.isPending}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {deleteUser.isPending ? 'Sletter...' : 'Slett bruker'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/UserDirectory.tsx
git commit -m "feat: admin delete user with reassignment confirm dialog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Post-implementation: deploy & manual QA (user-run)

Claude cannot deploy or mutate the project. After merge, the user runs:

```bash
supabase functions deploy admin-update-user admin-delete-user
```

Then verifies on `/admin/users`:
1. Edit a user's name → row + profile update; login unaffected.
2. Edit phone (E.164 via the picker) → that user can request an OTP on the new number.
3. Edit email → stored; toggle **Inspektør** on/off → target gains/loses `/admin/*`.
4. Demote/delete the last admin → blocked ("Kan ikke fjerne den siste administratoren.").
5. Delete self → the Slett button is hidden; direct call is blocked server-side.
6. As user X: create a shelter, upload a document, send an invite. Delete X → those now show the deleting admin as owner/inviter, and X disappears from the directory and all memberships. Toast reports the reassigned count.

## Self-Review

**Spec coverage:** Edit name/phone/email → Task 2 + Task 5. Admin toggle → Task 2 (server guard) + Task 5 (checkbox). Hard delete → Task 3 + Task 6. Reassignment of created_by/uploaded_by/invited_by(×2) → Task 3 (map matches spec table). Safety rails (self-delete, last-admin) → Tasks 2/3 server-side, Task 5/6 UI. No-migration decision, caller-JWT reassignment, `profiles→auth.users` cascade caveat → carried into Tasks 1/3. UI placement (inline row actions, plain confirm) → Tasks 5/6. All spec sections map to a task.

**Placeholder scan:** No TBD/TODO; every code step is complete. The only conditional (Task 3 Step 3) is an explicit, coded contingency with the exact line to add.

**Type consistency:** `UpdateUserInput`/`DeleteUserResult` defined in Task 4 and consumed unchanged in Tasks 5/6. `useUpdateUser`/`useDeleteUser` names consistent. `friendlyError` defined in Task 5, reused in Task 6. `requireAdmin`/`countAdmins`/`HttpError`/`json`/`corsHeaders` defined in Task 1, consumed with matching signatures in Tasks 2/3. `reassigned` shape identical in Task 3 (function) and Task 4 (`DeleteUserResult`).
