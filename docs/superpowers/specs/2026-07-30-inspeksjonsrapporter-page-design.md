# Inspeksjonsrapporter page — design

Date: 2026-07-30
Branch: `arealmaas/inspeksjonsrapporter-page`

## Goal

Add an admin-only **Inspeksjonsrapporter** page that lists inspection reports
(`vurdering` rows) grouped by status, shows which tilfluktsrom each report is
attached to, and lists unattached reports separately. Clicking a report opens
the existing detail view (`VurderingDetail`) with a breadcrumb rooted at
Inspeksjonsrapporter instead of Tilfluktsrom.

## Context (existing code)

- `/vurderinger/:id` → `src/pages/VurderingDetail.tsx` already renders the full
  report. Breadcrumb is hardcoded `Tilfluktsrom › [shelter] › #id`.
- `vurdering.status` is free-text; `vurdering.tilfluktsrom` is nullable.
- Hooks exist: `useVurderinger()` (all), `useShelters()` (all, admin sees all
  via RLS), `useUpdateVurdering()`.
- RLS: admins manage all `vurdering` rows; readers only SELECT reports for their
  own shelters → **readers can't see unattached reports** → page is admin-only.
- Commit #29 established the canonical status vocabulary + badge colors and a
  `reportStatusBadgeClass` helper (currently local to `ShelterDetail.tsx`), plus
  a duplicated `cleanStatus` helper in both `ShelterDetail` and `VurderingDetail`.

## Status vocabulary

Stored lowercase, matched case-insensitively. Canonical order (= group sort
order): **Opprettet → Påbegynt → Ferdigstilling → Gjennomført → Fullført**, then
an **Annet** bucket for legacy/unrecognized values (e.g. `publisert`).

Badge colors (reuse commit #29): `fullført`/`gjennomført` → green;
`påbegynt`/`ferdigstilling` → amber; `opprettet` + unrecognized → gray.

No DB migration — free-text stays; new values used going forward.

## Changes

### 1. `src/lib/reportStatus.ts` (new)

Central module:
- `REPORT_STATUSES` ordered const array + `ReportStatus` type.
- `REPORT_STATUS_LABELS` display labels.
- `cleanStatus(raw)` (moved from the two pages), `normalizeStatus(raw)`
  (clean + lowercase + trim), `reportStatusLabel(raw)` (label w/ capitalized
  fallback), `reportStatusBadgeClass(status)` (from #29).
- `groupReportsByStatus(reports)` → ordered non-empty buckets
  `{ key, label, badgeClass, reports }`, canonical order + Annet last.

`ShelterDetail.tsx` and `VurderingDetail.tsx` refactored to import from here
(remove local `cleanStatus` / `reportStatusBadgeClass`).

### 2. `src/pages/RapportList.tsx` (new, admin-only)

`useVurderinger()` + `useShelters()` joined client-side (Map by shelter id) to
attach shelter name. `AppLayout` wrapper. Two sections:
- **Tilknyttet tilfluktsrom** — reports with a shelter, grouped by status; rows:
  Rapport-ID, shelter (link `/tilfluktsrom/:id`), kontrolldato, status badge,
  chevron → `/inspeksjonsrapporter/:id`.
- **Uten tilfluktsrom** — reports where `tilfluktsrom` is null, same grouping,
  no shelter column.

Loading skeletons + empty states per `ShelterList` conventions.

### 3. Routing + breadcrumb

- New `AdminRoute`s: `/inspeksjonsrapporter` → `RapportList`;
  `/inspeksjonsrapporter/:id` → `VurderingDetail from="rapporter"`.
- `VurderingDetail` gains optional `from?: 'shelter' | 'rapporter'` (default
  `'shelter'`). `'rapporter'` → breadcrumb `Inspeksjonsrapporter › #id` (root →
  `/inspeksjonsrapporter`) and error back-link adjusted. Default unchanged.

### 4. Navigation

Add `{ href: '/inspeksjonsrapporter', label: 'Inspeksjonsrapporter', icon: FileText }`
to `adminNavItems` in `AppLayout.tsx`.

### 5. Statuses in editing

- `VurderingDetail` edit `<select>`: the 5 canonical statuses; header badge uses
  `reportStatusBadgeClass` + label.
- `ShelterDetail` create-report `<select>`: offer all 5 (currently only
  "Opprettet").

## Verification

- `npm run lint` + `npm run build` (tsc) clean.
- No test runner present in repo → not scaffolding one (out of scope).

## Out of scope (YAGNI)

Search/filter on the page, server-side joins, bulk status editing, data
migration of legacy statuses.
