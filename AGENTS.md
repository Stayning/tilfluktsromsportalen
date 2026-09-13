# AGENTS.md

This file provides guidance to Claude Code or OpenAI Codex when working with code in this repository.

## Instructions

- !IMPORTANT: Do not ever run any code that is potentially destrictive towards the database. Even db supabase db reset
- !IMPORTANT: Before starting to work, ensure you use git worktree to avoid conflicting with existing work.
- In order to learn more about the structure of the data / tables in the database, you can dump the database temporarily
- Always read the SPECIFICATION.md document
- Always run `npm run lint` and `npm run build` after code changes.
- Update the SPECIFICATION.md document whenever any changes are made that may impact this. Not for every change. 
- If using vibe kanban, there is an MCP related to it to enable creating tasks on vibe kanban. If these get complex, or it makes sense to split what you are currently doing in several tasks, please create a task on vibe kanban with appropriate information

## Project Overview

Tilfluktsrom ("Shelter Portal") is a Norwegian shelter registry and access management system. The core innovation is a "viral" invitation model where users can only invite others to shelters they already have access to, creating a secure chain-of-trust.

**MVP Phase 1 focuses on:** Registry Management, Viral Access Control, and Security (reporting features are deferred).

## Tech Stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS + Shadcn/UI (Radix), TanStack Query v5
- **Backend:** Supabase (PostgreSQL 15+, GoTrue Auth, Edge Functions, Storage)
- **Auth:** Phone OTP via SMS (Norwegian +47 numbers, E.164 format)

## Build Commands

```bash
# Frontend
npm install
npm run dev
npm run build
npm run lint

# Supabase
supabase start
supabase db reset
supabase migration new <name>
supabase gen types typescript --local > src/types/database.types.ts
supabase functions deploy accept-invite
```

## Running Migrations (Remote)

```bash
# One-time link (if not already linked)
supabase link --project-ref zvtqbhqdjcyxgeavhlbm

# Push local migrations to the remote project
supabase db push
```

## Architecture

### Core Principles
1. **Supabase Native:** Logic lives in the database (RLS, Triggers) or Edge Functions
2. **Infrastructure as Code:** All schema changes via versioned migrations in `supabase/migrations/` - no manual Dashboard changes
3. **Viral Security:** Users can only invite others to shelters they already have access to

### User Roles
- **Inspector (Admin):** Full system access, can manage all shelters and users, stored in `app_admins` table
- **Reader:** Access only to shelters they've been invited to via `tilfluktsrom_members`

### Database Tables
- `profiles` - User metadata linked to auth.users (first_name, last_name, phone, tos_accepted_at)
- `app_admins` - Global system administrators
- `tilfluktsrom` - Shelter registry with Norwegian property identifiers (kommune_nr, gnr, bnr)
- `tilfluktsrom_members` - Access control with `invited_by` lineage tracking and `is_active` flag
- `tilfluktsrom_invites` - Pending invitations keyed by phone number

### RLS Security Functions
```sql
is_admin()              -- Returns true if user is in app_admins
is_member(shelter_id)   -- Returns true if user has active membership
```

### Key Flows
1. **Login:** Phone input → OTP verification → Profile check
2. **Onboarding:** First/Last name + ToS acceptance → `accept-invite` Edge Function processes pending invites
3. **Viral Invite:** Member invites phone number → Invitee logs in → Auto-granted access to shelter

### Routes
- `/login` - Phone OTP authentication
- `/onboarding` - Profile completion + ToS (redirects to dashboard if already completed)
- `/dashboard` - Shelter overview (Inspector sees all, Reader sees assigned)
- `/shelters` - Filterable list with status badges
- `/shelters/:id` - Detail view with Info tab and Access/Members tab
- `/admin/users` - User directory with lineage visualization (Inspector only)

### Shelter Status Values
- `operational` (green badge)
- `maintenance_req` (amber badge)
- `critical` (red badge)
- `closed`

### User Status
- **Active** - Normal access
- **Pending** - Invited but hasn't logged in yet
- **Locked** - Access revoked via `is_active = false` (preserves history)

### TanStack Query Keys
```typescript
['shelters', { filter }]    // Shelter list
['shelter', id]             // Single shelter
['members', shelterId]      // Members for a shelter
```

Use query invalidation after mutations (not optimistic updates) due to RLS complexity.

## Project Structure

```
src/
  components/
    ui/           # Shadcn primitives
    shelters/     # ShelterCard, ShelterStatusBadge
    auth/         # LoginForm, OnboardingForm
    layout/       # Sidebar, Header, MobileNav
  hooks/
    useAuth.ts    # Supabase session wrapper
    useShelters.ts
  lib/
    supabase.ts   # Client instantiation
    utils.ts      # cn() helper, formatters
  pages/
  types/
    database.types.ts  # Generated from Supabase
supabase/
  migrations/
  functions/
    accept-invite/
```

## Git Workflow

- Use **conventional commits** (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- All changes should be submitted via **pull request** - do not push directly to main
- Also use conventional commits when creating pull request

## UI Reference

Screenshots in `screenshots-sketches/` show the design direction (these include future features like Reports that are not in MVP Phase 1).
