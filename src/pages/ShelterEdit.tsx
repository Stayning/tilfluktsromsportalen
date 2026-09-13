import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  useShelter,
  useUpdateShelter,
  useCreateShelter,
  useVurderinger,
  useShelterVurderinger,
  useAttachVurdering,
} from '@/hooks/useShelters'
import { useAuth } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import { ChevronLeft, Save, FileText, X } from 'lucide-react'

export default function ShelterEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id

  const { isAdmin, user } = useAuth()
  const { data: shelter, isLoading } = useShelter(isNew ? undefined : id)
  const updateMutation = useUpdateShelter()
  const createMutation = useCreateShelter()
  const { data: allVurderinger } = useVurderinger()
  const { data: shelterVurderinger } = useShelterVurderinger(isNew ? undefined : id)
  const attachVurdering = useAttachVurdering()

  const [selectedVurderingId, setSelectedVurderingId] = useState<string>('')
  const [attachedVurderinger, setAttachedVurderinger] = useState<string[]>([])

  const [formData, setFormData] = useState({
    alias: '',
    matrikkel: '',
    adresseGate: '',
    adressePostnr: '',
    adresseSted: '',
    plasser: '',
    byggeaar: '',
    konstruksjon: '',
  })
  const [error, setError] = useState<string | null>(null)

  // Populate form when shelter data loads
  useEffect(() => {
    if (shelter) {
      const adresse = shelter.adresse as { gate?: string; postnr?: string; sted?: string } | null
      setFormData({
        alias: shelter.alias || '',
        matrikkel: shelter.matrikkel || '',
        adresseGate: adresse?.gate || '',
        adressePostnr: adresse?.postnr || '',
        adresseSted: adresse?.sted || '',
        plasser: shelter.plasser?.toString() || '',
        byggeaar: shelter.byggeaar?.toString() || '',
        konstruksjon: shelter.konstruksjon || '',
      })
    }
  }, [shelter])

  // Populate attached vurderinger when data loads
  useEffect(() => {
    if (shelterVurderinger) {
      setAttachedVurderinger(shelterVurderinger.map((v) => v.id))
    }
  }, [shelterVurderinger])

  // (No matrikkel prefill from vurdering — vurdering rows do not carry matrikkel)

  // Wait for shelter data before applying the creator check (avoids "no permission" flash)
  if (!isNew && isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-500">Laster tilfluktsrom...</div>
        </div>
      </AppLayout>
    )
  }

  // Allow: creating new shelter, or admin, or the shelter's creator
  const canEdit = isNew || isAdmin || shelter?.created_by === user?.id
  if (!canEdit) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-red-600">
            Du har ikke tillatelse til å redigere tilfluktsrom.
          </div>
          <div className="text-center mt-4">
            <Link to="/tilfluktsrom" className="text-blue-600 hover:underline">
              ← Tilbake til tilfluktsrom
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Get available vurderinger: unattached ones + ones already attached to this shelter
  const availableVurderinger = allVurderinger?.filter(
    (v) => !v.tilfluktsrom || v.tilfluktsrom === id
  ) || []

  // Helper to clean status values (removes PostgreSQL type casting syntax)
  const cleanStatus = (status: string | null) => {
    if (!status) return null
    // Remove patterns like ('value'::character varying)
    // Handle both ('value'::type) and (value::type) formats
    if (status.startsWith('(') && status.includes('::')) {
      const inner = status.slice(1, status.indexOf('::'))
      return inner.replace(/^'|'$/g, '') // Remove surrounding quotes
    }
    return status
  }

  // Get display info for attached vurderinger
  const attachedVurderingerInfo = allVurderinger?.filter((v) => attachedVurderinger.includes(v.id)) || []

  const handleAddVurdering = () => {
    if (selectedVurderingId && !attachedVurderinger.includes(selectedVurderingId)) {
      setAttachedVurderinger([...attachedVurderinger, selectedVurderingId])
      setSelectedVurderingId('')
    }
  }

  const handleRemoveVurdering = (vurderingId: string) => {
    setAttachedVurderinger(attachedVurderinger.filter((id) => id !== vurderingId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const adresse = (formData.adresseGate || formData.adressePostnr || formData.adresseSted)
      ? {
          gate: formData.adresseGate || null,
          postnr: formData.adressePostnr || null,
          sted: formData.adresseSted || null,
        }
      : null

    const data = {
      alias: formData.alias || null,
      matrikkel: formData.matrikkel || null,
      adresse,
      plasser: formData.plasser ? parseInt(formData.plasser, 10) : null,
      byggeaar: formData.byggeaar ? parseInt(formData.byggeaar, 10) : null,
      konstruksjon: formData.konstruksjon || null,
    }

    try {
      let shelterId = id

      if (isNew) {
        // Generate a unique ID for new shelters (existing schema requires ID to be provided)
        const newId = `shelter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const created = await createMutation.mutateAsync({ ...data, id: newId })
        shelterId = created.id
      } else {
        await updateMutation.mutateAsync({ id: id!, data })
      }

      // Update vurdering attachments
      const originalAttached = shelterVurderinger?.map((v) => v.id) || []

      // Detach removed vurderinger
      for (const vId of originalAttached) {
        if (!attachedVurderinger.includes(vId)) {
          await attachVurdering.mutateAsync({ vurderingId: vId, shelterId: null })
        }
      }

      // Attach new vurderinger
      for (const vId of attachedVurderinger) {
        if (!originalAttached.includes(vId)) {
          await attachVurdering.mutateAsync({ vurderingId: vId, shelterId: shelterId! })
        }
      }

      navigate(`/tilfluktsrom/${shelterId}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const isPending = updateMutation.isPending || createMutation.isPending

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4">
          <Link
            to={isNew ? '/tilfluktsrom' : `/tilfluktsrom/${id}`}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            {isNew ? 'Tilfluktsrom' : 'Tilbake til tilfluktsrom'}
          </Link>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isNew ? 'Registrer nytt tilfluktsrom' : 'Rediger tilfluktsrom'}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Alias */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alias / navn
              </label>
              <input
                type="text"
                value={formData.alias}
                onChange={(e) =>
                  setFormData({ ...formData, alias: e.target.value })
                }
                placeholder="f.eks. Oslo Sentrum"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Matrikkel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matrikkel
              </label>
              <input
                type="text"
                value={formData.matrikkel}
                onChange={(e) =>
                  setFormData({ ...formData, matrikkel: e.target.value })
                }
                placeholder="f.eks. 0301-1/2"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Gateadresse */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gateadresse
              </label>
              <input
                type="text"
                value={formData.adresseGate}
                onChange={(e) =>
                  setFormData({ ...formData, adresseGate: e.target.value })
                }
                placeholder="f.eks. Storgata 1"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Postnummer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postnummer
              </label>
              <input
                type="text"
                value={formData.adressePostnr}
                onChange={(e) =>
                  setFormData({ ...formData, adressePostnr: e.target.value })
                }
                placeholder="f.eks. 0182"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sted */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sted
              </label>
              <input
                type="text"
                value={formData.adresseSted}
                onChange={(e) =>
                  setFormData({ ...formData, adresseSted: e.target.value })
                }
                placeholder="f.eks. Oslo"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kapasitet (personer)
              </label>
              <input
                type="number"
                value={formData.plasser}
                onChange={(e) =>
                  setFormData({ ...formData, plasser: e.target.value })
                }
                placeholder="f.eks. 200"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Year Built */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Byggeår
              </label>
              <input
                type="number"
                value={formData.byggeaar}
                onChange={(e) =>
                  setFormData({ ...formData, byggeaar: e.target.value })
                }
                placeholder="f.eks. 1985"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Construction Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Konstruksjonstype
              </label>
              <input
                type="text"
                value={formData.konstruksjon}
                onChange={(e) =>
                  setFormData({ ...formData, konstruksjon: e.target.value })
                }
                placeholder="f.eks. Armert betong"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Vurderinger Section — admin only */}
          {isAdmin && <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Tilknyttede vurderinger
            </h3>

            {/* Attached vurderinger list */}
            {attachedVurderingerInfo.length > 0 && (
              <div className="mb-4 space-y-2">
                {attachedVurderingerInfo.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {v.vurderingsnummer != null ? `#${v.vurderingsnummer}` : v.id}
                      </span>
                      {v.kontrolldato && (
                        <span className="text-gray-500 text-sm ml-2">
                          ({new Date(v.kontrolldato).toLocaleDateString()})
                        </span>
                      )}
                      {cleanStatus(v.status) && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                          {cleanStatus(v.status)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveVurdering(v.id)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add vurdering dropdown */}
            <div className="flex gap-2">
              <select
                value={selectedVurderingId}
                onChange={(e) => setSelectedVurderingId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Velg en vurdering å knytte til...</option>
                {availableVurderinger
                  .filter((v) => !attachedVurderinger.includes(v.id))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {[
                        v.vurderingsnummer != null ? `#${v.vurderingsnummer}` : null,
                        v.kontrolldato && new Date(v.kontrolldato).toLocaleDateString(),
                        cleanStatus(v.status) && `(${cleanStatus(v.status)})`,
                      ].filter(Boolean).join(' - ') || v.id}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleAddVurdering}
                disabled={!selectedVurderingId}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Legg til
              </button>
            </div>

            {availableVurderinger.filter((v) => !attachedVurderinger.includes(v.id)).length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Ingen tilgjengelige vurderinger å knytte til.
              </p>
            )}
          </div>}

          {error && (
            <p className="text-red-600 text-sm mt-4">{error}</p>
          )}

          <div className="mt-6 flex gap-3">
            <Link
              to={isNew ? '/tilfluktsrom' : `/tilfluktsrom/${id}`}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Avbryt
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'Lagrer...' : isNew ? 'Opprett tilfluktsrom' : 'Lagre endringer'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
