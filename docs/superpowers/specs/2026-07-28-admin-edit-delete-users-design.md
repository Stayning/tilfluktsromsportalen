# Admin: Edit & Delete Users — Design

**Date:** 2026-07-28
**Branch:** `arealmaas/admin-edit-users`
**Status:** Approved (pending spec review)

## Goal

Let Inspectors (admins) manage user accounts from the existing `/admin/users`
directory:

1. **Edit** a user's identity — first name, last name, phone, email — and toggle
   their admin (Inspektør) rights.
2. **Delete** a user — hard-remove their login.
3. On delete, **reassign** every resource the user authored to the admin who
   performs the deletion (so nothing is orphaned and no foreign key blocks the
   delete).

## Constraints

- **No mutation of the live Supabase project** during development. Schema/data
  may be pulled for reference only. All schema-as-code lands as migration files
  and edge-function source for the user to deploy; Claude does not deploy or run
  privileged operations against the project.
- Follow existing repo conventions: hand-rolled Tailwind modals (no Shadcn
  primitives are installed — `src/components/ui/` contains only `Skeleton.tsx`),
  TanStack Query with `invalidateQueries` (no optimistic updates), toast via
  `useToast()`, edge functions modeled on `supabase/functions/accept-invite`.

## Relevant current state (as explored)

### Auth / identity
- `src/lib/supabase.ts` — single browser client, anon key only. No admin client
  in the frontend (correct; service role must stay server-side).
- `supabase/functions/accept-invite/index.ts` is the template: it builds a
  **service-role** client (`SUPABASE_SERVICE_ROLE_KEY`) and a **caller-JWT**
  client (anon key + forwarded `Authorization` header), and identifies the
  caller with `supabaseClient.auth.getUser()`.
- The frontend invokes functions with `supabase.functions.invoke('accept-invite')`
  (`src/pages/Login.tsx:55`, `src/pages/Onboarding.tsx:50`), which auto-attaches
  the logged-in user's JWT.
- `src/contexts/AuthContext.tsx` exposes `isAdmin` (checked against `app_admins`)
  and gates admin routes via `AdminRoute` in `src/App.tsx` (`/admin/users` is
  already admin-only).

### Data model — user-referencing columns
Every user FK points at `profiles(id)` (which equals `auth.users.id`; profiles
are auto-created by the `handle_new_user` trigger on `auth.users` INSERT).

| Table.column | References | On delete | Semantics |
|---|---|---|---|
| `app_admins.user_id` | profiles(id) | **CASCADE** | admin rights (auto-removed) |
| `tilfluktsrom_members.user_id` | profiles(id) | **CASCADE** | the user's own access (auto-removed) |
| `tilfluktsrom_members.invited_by` | profiles(id) | NO ACTION | chain-of-trust lineage → **reassign** |
| `tilfluktsrom_invites.invited_by` | profiles(id) | NO ACTION | invites they sent → **reassign** |
| `tilfluktsrom.created_by` | profiles(id) | NO ACTION | shelters they created → **reassign** |
| `tilfluktsrom_documents.uploaded_by` | profiles(id) | SET NULL | documents they uploaded → **reassign** (override the SET NULL) |

Because `created_by` / `invited_by` are `NO ACTION`, deleting the profile (via
cascade from `auth.users`) **fails with a FK violation** unless those rows are
reassigned first. So reassignment is required both by the product rule and by
referential integrity.

`vurdering.utførende` is a **free-text** string (no FK to a user); assessments
are therefore not user-authored and need no reassignment.

### RLS / triggers that matter
- `is_admin()` — `SECURITY DEFINER`, returns true if `auth.uid()` is in
  `app_admins` (`20260409000000_add_is_admin_function.sql`).
- `profiles` has **no admin UPDATE policy** — only "Users can update own
  profile" (`USING auth.uid() = id`). This is why edit must go through a service-
  role edge function rather than a client write.
- `tilfluktsrom`: "Creators and admins can update shelters"
  (`USING is_admin() OR created_by = auth.uid()`); trigger
  `protect_shelter_created_by` reverts a `created_by` change only when
  `NOT is_admin()`. → an admin (non-null `auth.uid()` in `app_admins`) may
  reassign `created_by`; a service-role client (null `auth.uid()`) may **not**
  (the trigger would revert it). **Therefore reassignment runs through the
  caller's admin JWT client, not the service-role client.**
- `tilfluktsrom_members` / `tilfluktsrom_invites`: "Admins can manage …"
  `FOR ALL USING is_admin()`.
- `tilfluktsrom_documents`: `documents_update` allows `is_admin()`.

### Frontend
- `src/pages/UserDirectory.tsx` renders two tables (users **with** phone, users
  **without** phone). Each row already has an actions column; the with-phone
  table currently shows "Legg til i tilfluktsrom" and expandable per-membership
  lock/unlock. `AddToShelterModal` (same file) is the hand-rolled modal pattern
  to match: `fixed inset-0 z-50`, `bg-black/50` overlay, white card, `useToast`
  for feedback, error-message mapping on the mutation.
- User hooks live in `src/hooks/useShelters.ts`: `useAllUsers` (query key
  `['users']`), `useToggleMemberStatus`, `useAddUserToShelter`. The
  `UserWithMemberships` type includes `is_admin: boolean`.

## Architecture

Two edge functions + a shared helper; **no database migration required.**

```
supabase/functions/
  _shared/
    cors.ts          # shared CORS headers
    admin.ts         # requireAdmin(req) -> { callerId, adminClient, callerClient }
  admin-update-user/
    index.ts
  admin-delete-user/
    index.ts
```

`requireAdmin(req)`:
1. Read `Authorization`; 401 if missing.
2. Build `callerClient` (anon key + header) and `adminClient` (service role).
3. `callerClient.auth.getUser()` → `callerId`; 401 if invalid.
4. `adminClient.from('app_admins').select('user_id').eq('user_id', callerId)` —
   403 if not an admin. (Service role bypasses RLS; we check membership
   explicitly rather than relying on `is_admin()`, whose `auth.uid()` is null in
   the service-role client.)
5. Return `{ callerId, adminClient, callerClient }`.

### `admin-update-user`
Request body: `{ userId, first_name, last_name, phone, email, is_admin }`.

1. `requireAdmin`.
2. **Identity** via GoTrue Admin API (service role):
   `adminClient.auth.admin.updateUserById(userId, { phone, email,
   phone_confirm: true, email_confirm: true, user_metadata: { display_name } })`
   where `display_name = [first_name, last_name].filter(Boolean).join(' ')`.
   `*_confirm: true` so an admin-corrected phone/email is immediately usable for
   OTP login without a re-verification round-trip. Omit `phone`/`email` keys
   when unchanged/empty.
3. **Profile mirror** via service role:
   `adminClient.from('profiles').update({ first_name, last_name, full_name,
   phone, email }).eq('id', userId)` (there is no auth→profile update trigger, so
   sync explicitly).
4. **Admin toggle**: read current membership in `app_admins`.
   - promote (`is_admin` true, not currently admin): `insert { user_id: userId }`.
   - demote (`is_admin` false, currently admin): **guard** — count admins; if the
     target is the only one, return `409 { error: 'last_admin' }`. Otherwise
     `delete` the row.
5. Respond `{ ok: true }` or a structured `{ error }` with an appropriate status.

### `admin-delete-user`
Request body: `{ userId }`.

1. `requireAdmin`.
2. **Guards**: `userId === callerId` → `400 { error: 'cannot_delete_self' }`;
   if target is an admin and the only admin → `409 { error: 'last_admin' }`.
3. **Reassign to caller** through the **caller JWT client** (so `is_admin()` RLS
   + `protect_shelter_created_by` permit it). Run all four, collect row counts,
   abort on the first error (user still intact):
   - `tilfluktsrom` set `created_by = callerId` where `created_by = userId`
   - `tilfluktsrom_documents` set `uploaded_by = callerId` where `uploaded_by = userId`
   - `tilfluktsrom_invites` set `invited_by = callerId` where `invited_by = userId`
   - `tilfluktsrom_members` set `invited_by = callerId` where `invited_by = userId`
4. **Delete** the auth user: `adminClient.auth.admin.deleteUser(userId)`. This
   cascades `profiles` → `tilfluktsrom_members.user_id` and `app_admins.user_id`
   (both `ON DELETE CASCADE`); any remaining `documents.uploaded_by` would SET
   NULL, but step 3 already reassigned them.
5. Respond `{ ok: true, reassigned: { shelters, documents, invites, memberships } }`.

> Implementation verification: confirm `profiles.id → auth.users(id)` is
> `ON DELETE CASCADE` by pulling the live schema (read-only) before relying on
> the cascade. It is the standard Supabase pattern and consistent with
> `handle_new_user`, but verify. If it is *not* cascade, the function must also
> `adminClient.from('profiles').delete().eq('id', userId)` before
> `deleteUser` (which then cascades members/admins off the profile). Design the
> function to tolerate both by deleting the profile row explicitly if the auth
> delete reports a lingering-reference error.

### Frontend changes

**`src/hooks/useShelters.ts`** — add next to the existing user hooks:
- `useUpdateUser()` → `supabase.functions.invoke('admin-update-user', { body })`;
  `onSuccess` invalidate `['users']` (and, if editing self, the caller may need
  `refreshProfile()` — surfaced by the caller, not the hook).
- `useDeleteUser()` → `supabase.functions.invoke('admin-delete-user', { body: { userId } })`;
  `onSuccess` invalidate `['users']`, `['shelters']`, `['documents']`
  (created_by / uploaded_by changed).
- Both map `invoke` errors to `Error(message)` so callers can `try/catch` like
  `AddToShelterModal`.

**`src/pages/UserDirectory.tsx`**:
- Add **Rediger** (pencil) and **Slett** (trash, red) buttons to the actions
  column in *both* tables. Hide **Slett** on the current admin's own row
  (`user.id === auth user id`).
- `EditUserModal` — hand-rolled modal (match `AddToShelterModal`): inputs for
  first name, last name, phone, email; a checkbox "Inspektør (admin)". Prefill
  from the row. Submit → `useUpdateUser`. Toast success/'error'; inline error
  text. Disable the admin checkbox off→on/on→off appropriately; the server is the
  final authority on the last-admin guard (surface its `last_admin` error as a
  friendly message).
- `DeleteUserDialog` — hand-rolled destructive confirm (red). Copy explains:
  "Dette fjerner brukeren permanent. Tilfluktsrom, dokumenter og invitasjoner
  brukeren har opprettet blir overført til deg." Buttons: "Avbryt" /
  "Slett bruker" (no name-typing required — some users have no name). Submit →
  `useDeleteUser`; success toast may include reassignment counts.

### Safety rails (server-enforced; UI mirrors for UX)
- No self-delete.
- Cannot delete or demote the **last** admin.
- All privileged writes require an authenticated caller who is in `app_admins`.

### Error handling
- Edge functions return `accept-invite`-style JSON: `{ error: string }` + status
  (401 unauth, 403 not admin, 400 bad request / self-delete, 409 last-admin, 500
  unexpected), success `{ ok: true, ... }`.
- Frontend maps known cases to Norwegian toast/inline messages; unknown errors
  fall through to the raw message, matching `AddToShelterModal`.

## Verification

- `npm run build` and `npm run lint` must pass.
- Edge function TypeScript is Deno; it is not covered by the Vite build. Review
  for correctness; **the user deploys and tests** (`supabase functions deploy
  admin-update-user admin-delete-user`) — Claude cannot deploy or mutate the
  project.
- Manual QA checklist (post-deploy, user-run):
  1. Edit a user's name → row + profile update; login unaffected.
  2. Edit phone → user can request OTP on the new number.
  3. Promote to admin → they gain `/admin/*`; demote → they lose it.
  4. Attempt to demote/delete the last admin → blocked with a clear message.
  5. Attempt to delete self → blocked.
  6. Create a shelter + upload a doc + send an invite **as** user X, then delete
     X → those shelters/docs/invites now show the deleting admin as owner, and X
     is gone from the directory and from all memberships.

## Out of scope
Bulk delete, audit logging of admin actions, undo/restore, editing
`tos_accepted_at`/`role` columns directly.
