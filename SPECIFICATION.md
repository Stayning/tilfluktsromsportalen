Here is the updated **Technical Specification & Implementation Guide** for the Tilfluktsrom portal (current codebase as of Jan 20, 2026).

This version reflects the implemented reporting (vurdering) features, invite automation, current front‑end routes, and admin-managed report creation. Image uploads for reports are read-only (signed URLs from the `vurdering` bucket).

---

# 1. Technical Architecture

- **Frontend:** React (Vite) + TypeScript, React Router v7, Tailwind CSS v4, shadcn-style UI primitives, Lucide icons.
- **State/Server Data:** TanStack Query v5; REST/`supabase-js` mix (REST for profiles/admin flag; `supabase-js` for most data).
- **Backend:** Supabase (PostgreSQL 17), `public` schema: shelters, inspection reports (`vurdering`), deviations (`avvik`), members, invites, customers, helper functions.
- **Storage:** Supabase Storage bucket `vurdering`; photos stored at path `{vurdering_id}/photos/{photo_id}`; client fetches signed URLs (1h expiry) via `createSignedUrls`. No client write pipeline.
- **Edge Function:** `accept-invite` (Deno) finalizes pending invites for the logged-in user.

---

# 2. Database Schema (authoritative from migrations)

## 2.1 Helper functions
- `public.is_admin()` → bool, true if user exists in `public.app_admins`.
- `public.is_member(_shelter_id text)` → bool, true if user has active membership for the shelter.

## 2.2 `public` schema
- **profiles**
  - Columns: `id uuid PK` (auth.users), `first_name`, `last_name`, `email` (unique), `phone`, `tos_accepted_at`, timestamps.
  - Triggers: `handle_new_user` (creates profile on auth.users insert), `handle_updated_at` (maintains updated_at).
  - RLS: users can read/update self; admins read all; users can read profiles that share a shelter; users can insert self.
- **app_admins**
  - Columns: `user_id uuid PK`, `created_at`.
  - RLS: user can read own row; admins read full list.
- **tilfluktsrom_members**
  - Columns: `id uuid PK`, `shelter_id text` FK → `tilfluktsrom`, `user_id uuid` FK → profiles, `invited_by uuid`, `is_active` bool default true, `added_at`.
  - Uniqueness: (`shelter_id`, `user_id`).
  - RLS: admins full CRUD; members can SELECT rows for shelters they belong to.
- **tilfluktsrom_invites**
  - Columns: `id uuid PK`, `shelter_id text` FK → `tilfluktsrom`, `phone_number` text, `invited_by uuid`, `status text default 'pending'`, `created_at`.
  - Constraints: unique (`shelter_id`, `phone_number`); index on (`phone_number`, `status`).
  - Trigger `handle_new_invite` (BEFORE INSERT) auto-accepts if a completed profile with matching phone exists (with/without `+`), inserts membership if missing, sets status `accepted`.
  - RLS: admins SELECT/UPDATE/DELETE; members SELECT invites for their shelters; members or admins may INSERT (viral rule).

## 2.3 `public` schema — operational data

- **tilfluktsrom** — shelter registry. Key columns: `id text PK`, `alias`, `kundenavn`, `matrikkel`, `adresse jsonb`, `bruksareal`, `byggeaar`, `forskrift`, `fredsbruk`, `har_aggregat`, `konstruksjon`, `plasser`, `vannklosett`.
- **vurdering** — inspection report. Columns: `id text PK`, `tilfluktsrom text FK`, `kontrolldato`, `godkjent bool`, `tilstandsvurdering text`, `status text`, `skjema text`, `utførende text`, `kontaktperson_id uuid FK → kontaktpersoner`, `vurderingsnummer int`, timestamps.
- **avvik** — deviations. Columns: `id text PK`, `vurdering_id text FK`, `checklist_item_id text`, `emne text`, `beskrivelse text`, `photo_ids text[]`.
- **observasjoner** — observations (same shape as avvik). Columns: `id text PK`, `vurdering_id text FK`, `checklist_item_id text`, `emne text`, `beskrivelse text`, `photo_ids text[]`.
- **notater** — notes per checklist item. Columns: `id text PK`, `vurdering_id text FK`, `checklist_item_id text`, `notat text`, `photo_ids text[]`.
- **tilstand** — per-item condition status. Columns: `id text PK`, `vurdering_id text FK`, `checklist_item_id text`, `status text[]`.
- **kontaktpersoner** — contact persons. Columns: `id uuid PK`, `navn text`, `telefon text`, `epost text`, `aktiv bool`.
- **kunde** — customers/owners. Columns: `id bigint PK`, `navn text`, `nummer int`, `orgnr text`, `aktiv bool`.

## 2.4 Storage

- Bucket: `vurdering`. Photos referenced by `avvik`, `observasjoner`, and `notater` rows via `photo_ids: string[]` (each entry is a bare photo UUID).
- Storage path: `{vurdering_id}/photos/{photo_id}`.
- Client calls `supabase.storage.from('vurdering').createSignedUrls(paths, 3600)` for read access; no client upload pipeline.

---

# 3. Security & Access Control (RLS summary)

- **Shelters:** only admins can insert/update/delete; members can read only shelters they belong to.
- **Viral invites:** INSERT allowed for admins or members of the target shelter; uniqueness enforced; trigger auto-accepts for already-onboarded users.
- **Memberships:** admins manage; members can view memberships for their shelters; `is_active` supports lock/unlock without removal.
- **Customers (kunde):** admins only for SELECT/INSERT/UPDATE/DELETE.
- **Profiles:** users see self; admins see all; cross-visibility inside same shelter.
- **Reports & deviations:** admins can insert/update report metadata/avvik/observasjoner/notater; members see only records tied to shelters they belong to.
- **Photos:** client fetches signed URLs from `vurdering` bucket; no client upload.

This is the most critical logic to ensure the "viral" feature is secure.

### **Helper Functions**
```sql
-- Check if current user is a Global Admin (Inspector)
CREATE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if current user is a Member of a specific shelter
CREATE FUNCTION is_member(_shelter_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tilfluktsrom_members 
    WHERE shelter_id = _shelter_id AND user_id = auth.uid() AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### **Policy Definitions**

| Table | Action | Policy Logic | Explanation |
| :--- | :--- | :--- | :--- |
| `tilfluktsrom` | SELECT | `is_admin() OR is_member(id)` | Admins see all. Readers see only their shelters. |
| `tilfluktsrom` | INSERT/UPDATE | `is_admin()` | Only Admins manage master data & status. |
| `tilfluktsrom_members` | SELECT | `is_admin() OR is_member(shelter_id)` | Readers can see who else is in their shelter. |
| `tilfluktsrom_invites` | INSERT | `is_admin() OR is_member(shelter_id)` | **Viral Logic:** Readers can invite others, but *only* to shelters they belong to. |
| `profiles` | SELECT | `is_admin() OR id = auth.uid() OR (EXISTS in same shelter)` | Users can see profiles of colleagues in the same shelter. |
| `vurdering` | SELECT | `is_admin() OR is_member(tilfluktsrom_id)` | Readers can view reports for shelters they have access to. |
| `vurdering` | INSERT/UPDATE | `is_admin()` | Admins create reports and attach them to shelters. |
| `avvik` | SELECT | `is_admin() OR (member via vurdering's shelter)` | Readers can view deviations linked to their shelters. |
| `avvik` | INSERT | `is_admin()` | Admins add deviations to reports. |
| `kunde` | SELECT | `is_admin()` | Admins can load customer list for report creation. |

---

# 4. Edge Functions

**`accept-invite`**
- Input: Authorization Bearer token from client.
- Flow:
  1. Resolve auth user; derive phone (both `+` and no-`+` variants).
  2. Fetch pending invites for that phone.
  3. If membership missing, insert into `public.tilfluktsrom_members` with `invited_by`; set invite status to `accepted`.
  4. Returns `{ new_shelters_count }`.
- Notes: Uses service-role key internally; front-end calls it after OTP verification and after onboarding completion.

---

# 5. Frontend Routes & Behaviors

- `/innlogging` (Public): phone OTP; on success calls `accept-invite`.
- `/velkommen` (Protected for logged-in, not-onboarded): collects `first_name`, `last_name`, **email**, ToS checkbox; posts to `profiles`; calls `accept-invite`; then redirects to `/oversikt`.
- `/oversikt` (Protected): admin sees stats (total, operative, needs attention); list of recent/assigned shelters.
- `/tilfluktsrom` (Protected): list with filters `search` (title/kommune), `kommune`, `status`; admin CTA to create.
- `/tilfluktsrom/ny` (Protected, component gates admin): create shelter; kommune field uses client-side autocomplete backed by `kommuner.json`; client generates id `shelter-{timestamp}-{rand}` because DB expects provided text id. Selecting a vurdering pre-fills kommune/GNR/BNR when matrikkel matches `kommune-gnr/bnr`. If a vurdering is attached during creation and it contains an adresse, the shelter's `adresse` JSON is set from that vurdering.
- `/tilfluktsrom/:id` (Protected): info tab (master data, image placeholder, capacity, inspection report list); access tab (members list with lock/unlock for admins, invite modal with phone validation, pending invites with delete for admins); **admins can create new inspection reports below the report list**.
- `/tilfluktsrom/:id/rediger` (Protected, component gates admin): edit shelter and manage attached `vurdering` records (attach/detach by setting `tilfluktsrom_id`).
- `/vurderinger/:id` (Protected): detailed inspection view with status badge, tilstand summary (godkjent/ikke), grouped avvik with inline bilder, orphaned images section, sidebar with customer/address metadata, link back to shelter. Admins can edit non-image report fields and avvik (save/cancel flow); images remain read-only.
- `/admin/brukere` (Admin only): directory of users, memberships, ToS date; expandable per-user shelter list; lock/unlock memberships.
- `/admin/kunder` (Admin only): customer directory with create/edit for `kunde`.
- `/admin/kunder/:id` (Admin only): customer detail with connected shelters and aggregated user access list.
- Wildcard redirects to `/oversikt`.

---

# 6. Data Fetching & State

- Supabase client configured in `src/lib/supabase.ts` using env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **AuthContext**: listens to `onAuthStateChange`, fetches profile via REST `/rest/v1/profiles`, admin flag via `/rest/v1/app_admins`, exposes `signInWithOtp`, `verifyOtp`, `updateProfile`, `refreshProfile`.
- **Query keys** (TanStack): `['shelters', filters]`, `['shelter', id]`, `['members', shelterId]`, `['invites', shelterId]`, `['vurderinger']`, `['vurderinger', shelterId]`, `['vurdering', id]`, `['avvik', vurderingId]`, `['bilder', vurderingId]`, `['users']`, `['kunder']`, `['customers']`, `['customer', id]`, `['customer-shelters', customerNumber, customerName]`, `['customer-members', shelterIds]`, `['kommune-options']`.
- Kommune names are resolved client-side from `src/data/kommuner.json`; `kommune_nr` is still stored in the database and used for filters/search mapping.
- Mutations: create/update shelter, invite, delete invite, attach/detach vurdering, toggle membership status, create/update vurdering, create/update avvik, create/update customers.
- Notifications: `ToastContext` provides `showToast` used on invite/membership actions.

---

# 7. Storage & Media

- Photos for vurdering records (avvik, observasjoner, notater) live in bucket `vurdering`; path: `{vurdering_id}/photos/{photo_id}` where `photo_id` is a UUID stored in `photo_ids: string[]` on each row.
- Client calls `supabase.storage.from('vurdering').createSignedUrls(paths, 3600)` to get 1-hour signed read URLs.
- No client write (upload) pipeline; photos are managed outside the UI.

---

# 8. Implementation Checklist (current status)

**Phase 1: Foundation** ✅  
- Supabase project, phone auth, rate limits, Vite/Tailwind setup, base migrations applied, types generated.

**Phase 2: Authentication & Onboarding** ✅  
- OTP login; profile fetch; onboarding form now collects **email** + ToS; `accept-invite` edge function wired post-login and post-onboarding.

**Phase 3: Shelter Management (CRUD)** ✅  
- List/detail/edit/create for shelters; admin-only edit/create enforced in component; attachments between shelters and vurderinger implemented.  
- Storage for shelter images still pending (image_path only).

**Phase 4: Viral Access** ✅  
- Invite UI with phone validation; pending invites list with delete (admin); memberships lock/unlock; trigger + edge function handle auto-accept.

**Phase 5: Reports / Inspeksjoner** ✅  
- Viewing attached reports; full report detail with avvik and bilder; attach/detach reports to shelters; admin edit for non-image report fields and avvik.

**Phase 6: Storage** ✅  
- Authenticated read via signed URLs from `vurdering` bucket; no client upload/write flow.

**Phase 7: Deployment** ✅  
- Frontend deployed (Vercel, rewrite in `vercel.json`); Supabase URL/anon key and function envs are configured.

---

# 9. Project Structure (key files)

```
src/
  App.tsx                // Routes
  contexts/
    AuthContext.tsx
    ToastContext.tsx
  hooks/useShelters.ts   // Shelters, invites, memberships, vurderinger, avvik, bilder, kunder
  pages/
    Login.tsx
    Onboarding.tsx
    Dashboard.tsx
    ShelterList.tsx
    ShelterDetail.tsx
    ShelterEdit.tsx
    VurderingDetail.tsx
    UserDirectory.tsx
    CustomerDirectory.tsx
    CustomerDetail.tsx
  components/
    layout/AppLayout.tsx
    shelters/ShelterStatusBadge.tsx
    ui/Skeleton.tsx
  lib/supabase.ts
  types/database.types.ts // Generated types for public schema
  data/kommuner.json       // Kommune register (code + name + status)
  lib/kommuner.ts          // Kommune lookup + options

supabase/
  migrations/         # SQL files (versioned schema changes)
  functions/          # Deno Edge Functions
    accept-invite/    # Processes pending invites on onboarding
```

---

# 10. Open Items / Risks

- Shelter image upload flow is absent; `image_path` expects an existing URL/path.
- Storage write permissions for `vurdering` bucket not exposed to the client; any future photo upload feature needs policies and signed upload URLs.
- Client-generated shelter IDs rely on uniqueness; consider server-side UUID/text generation to avoid collisions.
