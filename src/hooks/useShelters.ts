import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { useAuth } from '@/contexts/AuthContext'
import { getFileExtension } from '@/lib/documentMime'
import type { DocumentTypeValue } from '@/lib/documentTypes'
import type {
  Database,
  Shelter,
  ShelterInsert,
  ShelterUpdate,
  Vurdering,
  VurderingInsert,
  VurderingUpdate,
  Avvik,
  AvvikInsert,
  AvvikUpdate,
  Kunde,
  KundeInsert,
  KundeUpdate,
  Profile,
  Kontaktperson,
  Notater,
  Observasjon,
  Tilstand,
} from '@/types/database.types'

interface ShelterFilters {
  search?: string
}

type MemberProfile = Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'>
type MemberInviter = Pick<Profile, 'id' | 'first_name' | 'last_name'>
type MembershipRow = Database['public']['Tables']['tilfluktsrom_members']['Row']
type InviteRow = Database['public']['Tables']['tilfluktsrom_invites']['Row']
type AdminRow = Database['public']['Tables']['app_admins']['Row']
type ShelterSummary = Pick<Shelter, 'id' | 'alias' | 'kundenavn'>
type CustomerShelterSummary = Pick<
  Shelter,
  'id' | 'alias' | 'kundenavn' | 'matrikkel' | 'plasser'
>

export type ShelterMember = MembershipRow & {
  profile?: MemberProfile | null
  inviter?: MemberInviter | null
}

export type ShelterInvite = InviteRow & {
  inviter?: MemberInviter | null
}

type MembershipWithInviter = MembershipRow & {
  inviter?: MemberInviter | null
}

export type MembershipWithShelter = MembershipWithInviter & {
  shelter?: ShelterSummary | null
}

type ProfileWithMemberships = Profile & {
  memberships?: MembershipWithInviter[] | null
}

export type UserWithMemberships = Profile & {
  is_admin: boolean
  memberships?: MembershipWithShelter[] | null
}

// Fetch all shelters the user has access to
export function useShelters(filters?: ShelterFilters) {
  return useQuery({
    queryKey: ['shelters', filters],
    queryFn: async () => {
      let query = supabase
        .from('tilfluktsrom')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.search) {
        query = query.or(`alias.ilike.%${filters.search}%,matrikkel.ilike.%${filters.search}%`)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Shelter[]
    },
  })
}

// Fetch a single shelter by ID
export function useShelter(id: string | undefined) {
  return useQuery({
    queryKey: ['shelter', id],
    queryFn: async () => {
      if (!id) throw new Error('No shelter ID provided')

      const { data, error } = await supabase
        .from('tilfluktsrom')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Shelter
    },
    enabled: !!id,
  })
}

// Fetch members of a shelter
export function useShelterMembers(shelterId: string | undefined) {
  return useQuery({
    queryKey: ['members', shelterId],
    queryFn: async () => {
      if (!shelterId) throw new Error('No shelter ID provided')

      const { data, error } = await supabase
        .from('tilfluktsrom_members')
        .select(`
          *,
          profile:profiles!tilfluktsrom_members_user_id_fkey(id, first_name, last_name, email, phone),
          inviter:profiles!tilfluktsrom_members_invited_by_fkey(id, first_name, last_name)
        `)
        .eq('shelter_id', shelterId)
        .order('added_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as ShelterMember[]
    },
    enabled: !!shelterId,
  })
}

// Fetch invitations for a shelter (admin only)
export function useShelterInvites(shelterId: string | undefined) {
  return useQuery({
    queryKey: ['invites', shelterId],
    queryFn: async () => {
      if (!shelterId) throw new Error('No shelter ID provided')

      const { data, error } = await supabase
        .from('tilfluktsrom_invites')
        .select(`
          *,
          inviter:profiles!tilfluktsrom_invites_invited_by_fkey(id, first_name, last_name)
        `)
        .eq('shelter_id', shelterId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as ShelterInvite[]
    },
    enabled: !!shelterId,
  })
}

// Create a new shelter
export function useCreateShelter() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (shelter: ShelterInsert) => {
      const { data, error } = await supabase
        .from('tilfluktsrom')
        .insert({ ...shelter, created_by: user?.id ?? null } as never)
        .select()
        .single()

      if (error) throw error
      return data as Shelter
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelters'] })
    },
  })
}

// Update a shelter (admin only)
export function useUpdateShelter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ShelterUpdate }) => {
      const { data: updated, error } = await supabase
        .from('tilfluktsrom')
        .update(data as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return updated as Shelter
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shelters'] })
      queryClient.invalidateQueries({ queryKey: ['shelter', data.id] })
    },
  })
}

// Invite a user to a shelter
export function useInviteToShelter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      shelterId,
      phoneNumber,
    }: {
      shelterId: string
      phoneNumber: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('tilfluktsrom_invites')
        .insert({
          shelter_id: shelterId,
          phone_number: phoneNumber,
          invited_by: user?.id,
        } as never)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['members', variables.shelterId] })
      queryClient.invalidateQueries({ queryKey: ['invites', variables.shelterId] })
    },
  })
}

// Add a user directly to a shelter (admin only)
// RLS policy "Admins can manage members" permits this insert; bypasses
// the phone-keyed invite flow which doesn't work for users missing a phone.
export function useAddUserToShelter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      shelterId,
      userId,
    }: {
      shelterId: string
      userId: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('tilfluktsrom_members')
        .insert({
          shelter_id: shelterId,
          user_id: userId,
          invited_by: user?.id,
          is_active: true,
        } as never)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['members', variables.shelterId] })
    },
  })
}

// Delete an invite (admin only)
export function useDeleteInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      inviteId,
    }: {
      inviteId: string
      shelterId: string
    }) => {
      const { error } = await supabase
        .from('tilfluktsrom_invites')
        .delete()
        .eq('id', inviteId)

      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invites', variables.shelterId] })
    },
  })
}

// Fetch active kunder (admin only)
export function useKunder() {
  return useQuery({
    queryKey: ['kunder'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunde')
        .select('id, nummer, navn, aktiv')
        .eq('aktiv', true)
        .order('navn', { ascending: true })

      if (error) throw error
      return data as Kunde[]
    },
  })
}

// Fetch all users with their shelter memberships (admin only)
export function useAllUsers() {
  return useQuery<UserWithMemberships[]>({
    queryKey: ['users'],
    queryFn: async () => {
      // First get all profiles with their memberships
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          memberships:tilfluktsrom_members!tilfluktsrom_members_user_id_fkey(
            id,
            shelter_id,
            is_active,
            added_at,
            inviter:profiles!tilfluktsrom_members_invited_by_fkey(id, first_name, last_name)
          )
        `)
        .order('updated_at', { ascending: false })

      if (profilesError) throw profilesError

      const { data: admins, error: adminsError } = await supabase
        .from('app_admins')
        .select('user_id')

      if (adminsError) throw adminsError

      const adminRows = (admins ?? []) as AdminRow[]
      const adminSet = new Set(adminRows.map((admin) => admin.user_id))

      // Then get shelter info for each membership
      const shelterIds = new Set<string>()
      const profileRows = (profiles ?? []) as ProfileWithMemberships[]
      profileRows.forEach((profile) => {
        profile.memberships?.forEach((membership) => {
          if (membership.shelter_id) shelterIds.add(membership.shelter_id)
        })
      })

      const shelterMap: Record<string, ShelterSummary> = {}
      if (shelterIds.size > 0) {
        const { data: shelters } = await supabase
          .from('tilfluktsrom')
          .select('id, alias, kundenavn')
          .in('id', Array.from(shelterIds))

        const shelterRows = (shelters ?? []) as ShelterSummary[]
        shelterRows.forEach((shelter) => {
          shelterMap[shelter.id] = shelter
        })
      }

      // Attach shelter info to memberships
      return profileRows.map((profile) => ({
        ...profile,
        is_admin: adminSet.has(profile.id),
        memberships:
          profile.memberships?.map((membership) => ({
            ...membership,
            shelter: membership.shelter_id ? shelterMap[membership.shelter_id] ?? null : null,
          })) ?? null,
      }))
    },
  })
}

// Fetch all kunder (admin only)
export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunde')
        .select('*')
        .order('navn', { ascending: true })

      if (error) throw error
      return data as Kunde[]
    },
  })
}

// Fetch a single kunde (admin only)
export function useCustomer(customerId: number | undefined) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      if (customerId === undefined) throw new Error('No customer ID provided')

      const { data, error } = await supabase
        .from('kunde')
        .select('*')
        .eq('id', customerId)
        .single()

      if (error) throw error
      return data as Kunde
    },
    enabled: customerId !== undefined,
  })
}

// Fetch shelters connected to a customer (via tilfluktsrom directly)
export function useCustomerShelters(
  customerNumber: number | null | undefined,
  customerName: string | null | undefined
) {
  const trimmedName = customerName?.trim() || null

  return useQuery({
    queryKey: ['customer-shelters', customerNumber ?? null, trimmedName ?? null],
    queryFn: async () => {
      if (customerNumber === null && !trimmedName) {
        throw new Error('No customer identifier provided')
      }

      const conditions: string[] = []

      if (customerNumber !== null && customerNumber !== undefined) {
        conditions.push(`kundenummer.eq.${customerNumber}`)
      }

      if (trimmedName) {
        conditions.push(`kundenavn.eq.${trimmedName}`)
      }

      const { data, error } = await supabase
        .from('tilfluktsrom')
        .select('id, alias, kundenavn, matrikkel, plasser')
        .or(conditions.join(','))
        .order('alias', { ascending: true })

      if (error) throw error
      return data as CustomerShelterSummary[]
    },
    enabled: customerNumber !== null && customerNumber !== undefined || !!trimmedName,
  })
}

// Fetch all members across a list of shelters (admin only)
export function useCustomerMembers(shelterIds: string[] | undefined) {
  const stableIds = Array.from(new Set(shelterIds ?? [])).sort()

  return useQuery({
    queryKey: ['customer-members', stableIds],
    queryFn: async () => {
      if (stableIds.length === 0) return []

      const { data, error } = await supabase
        .from('tilfluktsrom_members')
        .select(`
          *,
          profile:profiles!tilfluktsrom_members_user_id_fkey(id, first_name, last_name, email, phone)
        `)
        .in('shelter_id', stableIds)
        .order('added_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as ShelterMember[]
    },
    enabled: stableIds.length > 0,
  })
}

// Create a new kunde (admin only)
export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (customer: KundeInsert) => {
      const { data, error } = await supabase
        .from('kunde')
        .insert(customer as never)
        .select()
        .single()

      if (error) throw error
      return data as Kunde
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

// Update kunde information (admin only)
export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: KundeUpdate }) => {
      const { data: updated, error } = await supabase
        .from('kunde')
        .update(data as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return updated as Kunde
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

// Toggle member is_active status (admin only)
export function useToggleMemberStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      memberId,
      isActive,
    }: {
      memberId: string
      isActive: boolean
    }) => {
      const { data, error } = await supabase
        .from('tilfluktsrom_members')
        .update({ is_active: isActive } as never)
        .eq('id', memberId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// Fetch all vurderinger (for dropdown selection)
export function useVurderinger() {
  return useQuery({
    queryKey: ['vurderinger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vurdering')
        .select('*')
        .order('kontrolldato', { ascending: false })

      if (error) throw error
      return data as Vurdering[]
    },
  })
}

// Fetch vurderinger attached to a specific shelter
export function useShelterVurderinger(shelterId: string | undefined) {
  return useQuery({
    queryKey: ['vurderinger', shelterId],
    queryFn: async () => {
      if (!shelterId) throw new Error('No shelter ID provided')

      const { data, error } = await supabase
        .from('vurdering')
        .select('*')
        .eq('tilfluktsrom', shelterId)
        .order('kontrolldato', { ascending: false })

      if (error) throw error
      return data as Vurdering[]
    },
    enabled: !!shelterId,
  })
}

// Attach a vurdering to a shelter (update tilfluktsrom)
export function useAttachVurdering() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      vurderingId,
      shelterId,
    }: {
      vurderingId: string
      shelterId: string | null
    }) => {
      const { data, error } = await supabase
        .from('vurdering')
        .update({ tilfluktsrom: shelterId } as never)
        .eq('id', vurderingId)
        .select()
        .single()

      if (error) throw error
      return data as Vurdering
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vurderinger'] })
      if (variables.shelterId) {
        queryClient.invalidateQueries({ queryKey: ['vurderinger', variables.shelterId] })
      }
    },
  })
}

// Update a vurdering (report)
export function useUpdateVurdering() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VurderingUpdate }) => {
      const { data: updated, error } = await supabase
        .from('vurdering')
        .update(data as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return updated as Vurdering
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vurdering', data.id] })
      queryClient.invalidateQueries({ queryKey: ['vurderinger'] })
      if (data.tilfluktsrom) {
        queryClient.invalidateQueries({ queryKey: ['vurderinger', data.tilfluktsrom] })
      }
    },
  })
}

// Create a new vurdering (admin only)
export function useCreateVurdering() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vurdering: VurderingInsert) => {
      const { data, error } = await supabase
        .from('vurdering')
        .insert(vurdering as never)
        .select()
        .single()

      if (error) throw error
      return data as Vurdering
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vurderinger'] })
      if (data.tilfluktsrom) {
        queryClient.invalidateQueries({ queryKey: ['vurderinger', data.tilfluktsrom] })
      }
    },
  })
}

// Create avvik entries for a vurdering (admin only)
export function useCreateAvvik() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      avvik,
    }: {
      vurderingId: string
      avvik: AvvikInsert[]
    }) => {
      const { data, error } = await supabase
        .from('avvik')
        .insert(avvik as never)
        .select()

      if (error) throw error
      return data as Avvik[]
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['avvik', variables.vurderingId] })
    },
  })
}

// Fetch a single vurdering by ID
export function useVurdering(id: string | undefined) {
  return useQuery({
    queryKey: ['vurdering', id],
    queryFn: async () => {
      if (!id) throw new Error('No vurdering ID provided')

      const { data, error } = await supabase
        .from('vurdering')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Vurdering
    },
    enabled: !!id,
  })
}

// Fetch avvik (deviations) for a vurdering
export function useVurderingAvvik(vurderingId: string | undefined) {
  return useQuery({
    queryKey: ['avvik', vurderingId],
    queryFn: async () => {
      if (!vurderingId) throw new Error('No vurdering ID provided')

      const { data, error } = await supabase
        .from('avvik')
        .select('*')
        .eq('vurdering_id', vurderingId)
        .order('id', { ascending: true })

      if (error) throw error
      return data as Avvik[]
    },
    enabled: !!vurderingId,
  })
}

// Update avvik for a vurdering
export function useUpdateAvvik() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AvvikUpdate }) => {
      const { data: updated, error } = await supabase
        .from('avvik')
        .update(data as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return updated as Avvik
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['avvik', data.vurdering_id] })
    },
  })
}

// Fetch notater for a vurdering
export function useVurderingNotater(vurderingId: string | undefined) {
  return useQuery({
    queryKey: ['notater', vurderingId],
    queryFn: async () => {
      if (!vurderingId) throw new Error('No vurdering ID provided')
      const { data, error } = await supabase
        .from('notater')
        .select('*')
        .eq('vurdering_id', vurderingId)
        .order('id', { ascending: true })
      if (error) throw error
      return data as Notater[]
    },
    enabled: !!vurderingId,
  })
}

// Fetch observasjoner for a vurdering
export function useVurderingObservasjoner(vurderingId: string | undefined) {
  return useQuery({
    queryKey: ['observasjoner', vurderingId],
    queryFn: async () => {
      if (!vurderingId) throw new Error('No vurdering ID provided')
      const { data, error } = await supabase
        .from('observasjoner')
        .select('*')
        .eq('vurdering_id', vurderingId)
        .order('id', { ascending: true })
      if (error) throw error
      return data as Observasjon[]
    },
    enabled: !!vurderingId,
  })
}

// Fetch tilstand (per-item condition) for a vurdering
export function useVurderingTilstand(vurderingId: string | undefined) {
  return useQuery({
    queryKey: ['tilstand', vurderingId],
    queryFn: async () => {
      if (!vurderingId) throw new Error('No vurdering ID provided')
      const { data, error } = await supabase
        .from('tilstand')
        .select('*')
        .eq('vurdering_id', vurderingId)
        .order('id', { ascending: true })
      if (error) throw error
      return data as Tilstand[]
    },
    enabled: !!vurderingId,
  })
}

// Fetch a single kontaktperson by id
export function useKontaktperson(kontaktpersonId: string | null | undefined) {
  return useQuery({
    queryKey: ['kontaktperson', kontaktpersonId],
    queryFn: async () => {
      if (!kontaktpersonId) throw new Error('No kontaktperson ID provided')
      const { data, error } = await supabase
        .from('kontaktpersoner')
        .select('*')
        .eq('id', kontaktpersonId)
        .single()
      if (error) throw error
      return data as Kontaktperson
    },
    enabled: !!kontaktpersonId,
  })
}

export interface SignedPhotoUrl {
  photoId: string
  signedUrl: string
}

// Fetch signed photo URLs for a vurdering's photo IDs
export function useSignedPhotoUrls(
  vurderingId: string | undefined,
  photoIds: string[] | null | undefined
) {
  const ids = photoIds ?? []
  return useQuery({
    queryKey: ['photo-urls', vurderingId, ...ids],
    queryFn: async () => {
      if (!vurderingId || ids.length === 0) return []
      const paths = ids.map((photoId) => `${vurderingId}/photos/${photoId}`)
      const { data, error } = await supabase.storage
        .from('vurdering')
        .createSignedUrls(paths, 3600)
      if (error) throw error
      return ids.map((photoId, i): SignedPhotoUrl => ({
        photoId,
        signedUrl: data[i]?.signedUrl ?? '',
      }))
    },
    enabled: !!vurderingId && ids.length > 0,
    staleTime: 1000 * 60 * 50, // 50 minutes — slightly under 1h URL expiry
  })
}

// ---------- Sjekkliste (checklist items with forskrift references) ----------

export interface SjekklisteItem {
  group_id: number
  group_title: string
  item_id: string
  item_title: string
  forskrift_refs: string[]
}

export function useSjekkliste(forskriftYear: string | null | undefined) {
  return useQuery({
    queryKey: ['sjekkliste', forskriftYear],
    queryFn: async () => {
      if (!forskriftYear) throw new Error('No forskrift year')
      const { data, error } = await supabase.rpc('get_sjekkliste', {
        forskrift_year: forskriftYear,
      })
      if (error) throw error
      return data as SjekklisteItem[]
    },
    enabled: !!forskriftYear,
    staleTime: 1000 * 60 * 60, // checklist definitions rarely change
  })
}

export interface ForskriftInnhold {
  punkt: string
  innhold: string
}

export function useForskriftInnhold(forskriftYear: string | null | undefined, punktRefs: string[]) {
  return useQuery({
    queryKey: ['forskrift-innhold', forskriftYear, punktRefs],
    queryFn: async () => {
      if (!forskriftYear || punktRefs.length === 0) throw new Error('Missing params')
      const { data, error } = await supabase.rpc('get_forskrift_innhold', {
        forskrift_year: forskriftYear,
        punkt_refs: punktRefs,
      })
      if (error) throw error
      return data as ForskriftInnhold[]
    },
    enabled: !!forskriftYear && punktRefs.length > 0,
    staleTime: 1000 * 60 * 60,
  })
}

// ============================================================
// Document hooks (types defined inline until migration is applied and types regenerated)
// ============================================================

export interface ShelterDocument {
  id: string
  tilfluktsrom_id: string
  document_type: DocumentTypeValue
  file_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
  profiles?: {
    first_name: string | null
    last_name: string | null
  } | null
}

export function useShelterDocuments(shelterId: string | undefined) {
  return useQuery({
    queryKey: ['documents', shelterId],
    queryFn: async () => {
      if (!shelterId) throw new Error('No shelter id')
      const { data, error } = await supabase
        .from('tilfluktsrom_documents')
        .select('*, profiles!uploaded_by(first_name, last_name)')
        .eq('tilfluktsrom_id', shelterId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ShelterDocument[]
    },
    enabled: !!shelterId,
  })
}

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_DOCUMENTS_PER_SHELTER = 40

function sanitizeUploadedFileName(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/\s+/g, ' ').trim()
}

async function uploadDocumentObject(shelterId: string, file: File) {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error('Filen er for stor. Maks 10 MB.')
  }
  const contentType = file.type || 'application/octet-stream'
  const ext = getFileExtension(file.name) ?? 'bin'
  const path = `${shelterId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('tilfluktsrom-documents')
    .upload(path, file, { contentType, upsert: false })
  if (error) throw error
  return { path, contentType }
}

export function useUploadShelterDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      shelterId,
      file,
      documentType,
    }: {
      shelterId: string
      file: File
      documentType: DocumentTypeValue
    }) => {
      const { count, error: countError } = await supabase
        .from('tilfluktsrom_documents')
        .select('id', { count: 'exact', head: true })
        .eq('tilfluktsrom_id', shelterId)
      if (countError) throw countError
      if ((count ?? 0) >= MAX_DOCUMENTS_PER_SHELTER) {
        throw new Error('Maks 40 filer per tilfluktsrom.')
      }

      const { path, contentType } = await uploadDocumentObject(shelterId, file)

      const { error: dbError } = await supabase
        .from('tilfluktsrom_documents')
        .insert({
          tilfluktsrom_id: shelterId,
          document_type: documentType,
          file_path: path,
          file_name: sanitizeUploadedFileName(file.name),
          mime_type: contentType,
          size_bytes: file.size,
        })
      if (dbError) {
        await supabase.storage.from('tilfluktsrom-documents').remove([path])
        throw dbError
      }
      return path
    },
    onSuccess: (_data, { shelterId }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', shelterId] })
    },
  })
}

// Replace updates the existing row in place to avoid tripping the
// per-shelter cap trigger (which fires only on INSERT). Net document
// count stays constant.
export function useReplaceShelterDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      shelterId,
      file,
      existing,
    }: {
      shelterId: string
      file: File
      existing: ShelterDocument
    }) => {
      const { path, contentType } = await uploadDocumentObject(shelterId, file)

      const { error: dbError } = await supabase
        .from('tilfluktsrom_documents')
        .update({
          file_path: path,
          file_name: sanitizeUploadedFileName(file.name),
          mime_type: contentType,
          size_bytes: file.size,
        })
        .eq('id', existing.id)
      if (dbError) {
        await supabase.storage.from('tilfluktsrom-documents').remove([path])
        throw dbError
      }

      const { error: removeError } = await supabase.storage
        .from('tilfluktsrom-documents')
        .remove([existing.file_path])
      if (removeError) {
        return { path, oldRemoved: false as const }
      }
      return { path, oldRemoved: true as const }
    },
    onSuccess: (_data, { shelterId }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', shelterId] })
    },
  })
}

export function useDeleteShelterDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      filePath,
    }: {
      id: string
      filePath: string
      shelterId: string
    }) => {
      const { error: storageError } = await supabase.storage
        .from('tilfluktsrom-documents')
        .remove([filePath])
      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from('tilfluktsrom_documents')
        .delete()
        .eq('id', id)
      if (dbError) throw dbError
    },
    onSuccess: (_data, { shelterId }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', shelterId] })
    },
  })
}

export async function getSignedDocumentUrl(filePath: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('tilfluktsrom-documents')
    .createSignedUrl(filePath, expiresIn)
  if (error) throw error
  return data.signedUrl
}

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

// Surface an edge-function failure as a human-readable Error.
// Our functions return `{ error: code }`, but the platform gateway uses
// `{ message, code }` (e.g. a 404 when the function isn't deployed to the
// project the app points at) — handle both so a misconfiguration surfaces the
// real reason instead of an opaque `{}`.
async function toInvokeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      const detail = body?.error ?? body?.message ?? body?.code
      if (detail) return new Error(String(detail))
    } catch {
      // body wasn't JSON — fall through to the generic message
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
