import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  useShelter,
  useShelterMembers,
  useShelterInvites,
  useShelterVurderinger,
  useInviteToShelter,
  useDeleteInvite,
  useToggleMemberStatus,
  useCreateVurdering,
  useCreateAvvik,
  useKunder,
} from '@/hooks/useShelters'
import DocumentsSection from '@/components/shelters/DocumentsSection'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import AppLayout from '@/components/layout/AppLayout'
import PhoneInput, { isValidPhoneNumber, formatPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import {
  ChevronLeft,
  Edit,
  Building2,
  MapPin,
  Users,
  UserPlus,
  Lock,
  Unlock,
  FileText,
  Eye,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Vurdering } from '@/types/database.types'
import {
  cleanStatus,
  reportStatusBadgeClass,
  REPORT_STATUS_OPTIONS,
} from '@/lib/reportStatus'

type Tab = 'info' | 'access'

export default function ShelterDetail() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [showInviteModal, setShowInviteModal] = useState(false)

  const { isAdmin, user } = useAuth()
  const { data: shelter, isLoading, error } = useShelter(id)
  const { data: members } = useShelterMembers(id)
  const { data: invites } = useShelterInvites(id)
  const { data: vurderinger } = useShelterVurderinger(id)

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-500">Laster tilfluktsrom...</div>
        </div>
      </AppLayout>
    )
  }

  if (error || !shelter) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-red-600">
            {error ? (error as Error).message : 'Tilfluktsrom ikke funnet'}
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

  const shelterName = shelter.alias || shelter.kundenavn || shelter.id
  const canManageDocuments = isAdmin || shelter.created_by === user?.id

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4">
          <Link
            to="/tilfluktsrom"
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Tilfluktsrom
          </Link>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{shelterName}</h1>
            </div>
            {shelter.matrikkel && (
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {shelter.matrikkel}
              </p>
            )}
          </div>
          {(isAdmin || shelter.created_by === user?.id) && (
            <Link
              to={`/tilfluktsrom/${id}/rediger`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Rediger tilfluktsrom
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('info')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'info'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              Grunndata
            </button>
            <button
              onClick={() => setActiveTab('access')}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                activeTab === 'access'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              Tilgang
              {members && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {members.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'info' ? (
          <InfoTab
            shelter={shelter}
            vurderinger={vurderinger}
            isAdmin={isAdmin}
            canManageDocuments={canManageDocuments}
          />
        ) : (
          <AccessTab
            shelterId={shelter.id}
            members={members}
            invites={invites}
            onInvite={() => setShowInviteModal(true)}
            isAdmin={isAdmin}
          />
        )}

        {/* Invite Modal */}
        {showInviteModal && (
          <InviteModal
            shelterId={shelter.id}
            onClose={() => setShowInviteModal(false)}
          />
        )}
      </div>
    </AppLayout>
  )
}

function InfoTab({
  shelter,
  vurderinger,
  isAdmin,
  canManageDocuments,
}: {
  shelter: NonNullable<ReturnType<typeof useShelter>['data']>
  vurderinger: Vurdering[] | undefined
  isAdmin: boolean
  canManageDocuments: boolean
}) {
  // Report status is one of: Opprettet | Påbegynt | Gjennomført | Ferdigstilling | Fullført.
  // Non-admins only see completed ("Fullført") reports (matched case-insensitively); admins see all.
  const visibleVurderinger = isAdmin
    ? vurderinger
    : vurderinger?.filter(
        (v) => cleanStatus(v.status)?.toLowerCase().trim() === 'fullført'
      )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generell informasjon</h2>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Matrikkel</dt>
              <dd className="mt-1 text-gray-900">{shelter.matrikkel || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Type</dt>
              <dd className="mt-1 text-gray-900">{shelter.type || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Konstruksjon</dt>
              <dd className="mt-1 text-gray-900">{shelter.konstruksjon || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Slusetype</dt>
              <dd className="mt-1 text-gray-900">{shelter.sluse_type || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Byggeår</dt>
              <dd className="mt-1 text-gray-900">{shelter.byggeaar || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Fredsbruk</dt>
              <dd className="mt-1 text-gray-900">{shelter.fredsbruk || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Aggregat</dt>
              <dd className="mt-1 text-gray-900">{shelter.har_aggregat != null ? String(shelter.har_aggregat) : '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Forskrift</dt>
              <dd className="mt-1 text-gray-900">{shelter.forskrift || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Bruksareal</dt>
              <dd className="mt-1 text-gray-900">{shelter.bruksareal ? `${shelter.bruksareal} m²` : '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Vannklosett</dt>
              <dd className="mt-1 text-gray-900">{shelter.vannklosett != null ? String(shelter.vannklosett) : '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Antall plasser</dt>
              <dd className="mt-1 text-gray-900">{shelter.plasser ? `${shelter.plasser} personer` : '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Tegninger</dt>
              <dd className="mt-1 text-gray-900">{shelter.tegninger || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Urinal</dt>
              <dd className="mt-1 text-gray-900">{shelter.urinal != null ? String(shelter.urinal) : '-'}</dd>
            </div>
          </dl>
        </div>

        {/* Image placeholder */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="w-full h-64 bg-gray-100 flex items-center justify-center">
            <Building2 className="w-16 h-16 text-gray-300" />
          </div>
        </div>
      </div>

      {/* Inspection Reports */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Inspeksjonsrapporter
          </h2>
        </div>

        {!visibleVurderinger || visibleVurderinger.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Ingen inspeksjonsrapporter knyttet til dette tilfluktsrommet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rapport-ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skjematype
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tilstand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Handlinger
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibleVurderinger.map((v) => {
                  const status = cleanStatus(v.status)
                  const tilstandsvurdering = v.tilstandsvurdering

                  return (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link
                          to={`/vurderinger/${v.id}`}
                          className="font-medium text-gray-900 hover:text-blue-700"
                        >
                          {v.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {v.kontrolldato
                          ? new Date(v.kontrolldato).toLocaleDateString()
                          : v.created_at
                          ? new Date(v.created_at).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {v.skjema || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {v.godkjent != null ? (
                          v.godkjent ? (
                            <span className="inline-flex items-center gap-1 text-green-700">
                              <CheckCircle className="w-4 h-4" />
                              Godkjent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <AlertTriangle className="w-4 h-4" />
                              Avvik
                            </span>
                          )
                        ) : tilstandsvurdering ? (
                          <span className="text-gray-700">{tilstandsvurdering}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {status && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${reportStatusBadgeClass(status)}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/vurderinger/${v.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4" />
                          Vis
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DocumentsSection shelterId={shelter.id} canManageDocuments={canManageDocuments} />

      {isAdmin && (
        <CreateReportForm shelterId={shelter.id} />
      )}
    </div>
  )
}


type AvvikDraft = {
  id: string
  emne: string
  beskrivelse: string
}

const createLocalId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function CreateReportForm({ shelterId }: { shelterId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    kontrolldato: '',
    status: 'opprettet',
    skjema: '',
    forskrift: '',
    matrikkel: '',
    adresseGate: '',
    adresseSted: '',
    tilstandGodkjent: '',
    tilstandVurdering: '',
  })
  const [avvikItems, setAvvikItems] = useState<AvvikDraft[]>([])
  const [selectedKundeId, setSelectedKundeId] = useState<string>('')

  const { data: kunder, isLoading: kunderLoading, error: kunderError } = useKunder()
  const createVurdering = useCreateVurdering()
  const createAvvik = useCreateAvvik()
  const { showToast } = useToast()

  const isPending = createVurdering.isPending || createAvvik.isPending
  const selectedKunde = selectedKundeId
    ? kunder?.find((kunde) => String(kunde.id) === selectedKundeId) || null
    : null

  const resetForm = () => {
    setFormData({
      kontrolldato: '',
      status: 'opprettet',
      skjema: '',
      forskrift: '',
      matrikkel: '',
      adresseGate: '',
      adresseSted: '',
      tilstandGodkjent: '',
      tilstandVurdering: '',
    })
    setAvvikItems([])
    setSelectedKundeId('')
    setError(null)
  }

  useEffect(() => {
    if (selectedKundeId || !kunder || kunder.length === 0) return
    const defaultKunde = kunder.find((kunde) => kunde.navn?.toLowerCase() === 'ingen')
    if (defaultKunde) {
      setSelectedKundeId(String(defaultKunde.id))
    }
  }, [kunder, selectedKundeId])

  const handleAddAvvik = () => {
    setAvvikItems((prev) => [
      ...prev,
      {
        id: createLocalId(),
        emne: '',
        beskrivelse: '',
      },
    ])
  }

  const handleRemoveAvvik = (id: string) => {
    setAvvikItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (kunder && kunder.length > 0 && !selectedKundeId) {
      setError('Velg en kunde fra listen')
      return
    }

    const reportId = createLocalId()

    const avvikPayload = avvikItems
      .filter((item) =>
        [item.emne, item.beskrivelse].some(
          (value) => value && value.trim().length > 0
        )
      )
      .map((item) => ({
        id: createLocalId(),
        vurdering_id: reportId,
        checklist_item_id: 'default',
        emne: item.emne || '',
        beskrivelse: item.beskrivelse || '',
      }))

    try {
      await createVurdering.mutateAsync({
        id: reportId,
        tilfluktsrom: shelterId,
        kontrolldato: formData.kontrolldato || null,
        status: formData.status || null,
        skjema: formData.skjema || null,
        tilstandsvurdering: formData.tilstandVurdering || null,
        godkjent: formData.tilstandGodkjent === '' ? null : formData.tilstandGodkjent === 'true',
      })

      if (avvikPayload.length > 0) {
        try {
          await createAvvik.mutateAsync({ vurderingId: reportId, avvik: avvikPayload })
        } catch {
          showToast('Rapport opprettet, men avvik kunne ikke lagres', 'error')
        }
      }

      showToast('Rapport opprettet', 'success')
      resetForm()
      setIsOpen(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Ny inspeksjonsrapport
        </h2>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          {isOpen ? 'Skjul skjema' : 'Opprett rapport'}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
              Rapportdetaljer
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kontrolldato
                </label>
                <input
                  type="date"
                  value={formData.kontrolldato}
                  onChange={(e) =>
                    setFormData({ ...formData, kontrolldato: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {REPORT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Skjematype
                </label>
                <input
                  type="text"
                  value={formData.skjema}
                  onChange={(e) =>
                    setFormData({ ...formData, skjema: e.target.value })
                  }
                  placeholder="f.eks. Skjema 4"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forskrift
                </label>
                <input
                  type="text"
                  value={formData.forskrift}
                  onChange={(e) =>
                    setFormData({ ...formData, forskrift: e.target.value })
                  }
                  placeholder="f.eks. Sivilforsvarsloven"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
              Kunde og adresse
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kunde
                </label>
                <select
                  value={selectedKundeId}
                  onChange={(e) => setSelectedKundeId(e.target.value)}
                  disabled={kunderLoading || !kunder || kunder.length === 0}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value="">
                    {kunderLoading
                      ? 'Laster kunder...'
                      : !kunder || kunder.length === 0
                      ? 'Ingen kunder tilgjengelig'
                      : 'Velg kunde'}
                  </option>
                  {kunder?.map((kunde) => (
                    <option key={kunde.id} value={String(kunde.id)}>
                      {kunde.navn}
                      {kunde.nummer ? ` (${kunde.nummer})` : ''}
                    </option>
                  ))}
                </select>
                {kunderError && (
                  <p className="text-sm text-red-600 mt-2">
                    Kunne ikke hente kundelisten. Prøv igjen senere.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kundenummer
                </label>
                <input
                  type="text"
                  value={selectedKunde?.nummer ?? ''}
                  readOnly
                  placeholder="Velg kunde"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
                />
              </div>
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
                  placeholder="f.eks. 0301/1/2"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
                  placeholder="Gate og nummer"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
                  placeholder="Postnummer og sted"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
              Generell tilstand
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tilstand
                </label>
                <select
                  value={formData.tilstandGodkjent}
                  onChange={(e) =>
                    setFormData({ ...formData, tilstandGodkjent: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Velg tilstand</option>
                  <option value="true">Godkjent</option>
                  <option value="false">Ikke godkjent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sammendrag
                </label>
                <textarea
                  rows={3}
                  value={formData.tilstandVurdering}
                  onChange={(e) =>
                    setFormData({ ...formData, tilstandVurdering: e.target.value })
                  }
                  placeholder="Kort vurdering av tilstanden"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Avvik
              </h3>
              <button
                type="button"
                onClick={handleAddAvvik}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                <Plus className="w-4 h-4" />
                Legg til avvik
              </button>
            </div>

            {avvikItems.length === 0 ? (
              <p className="text-sm text-gray-500">
                Ingen avvik lagt til ennå. Bilder kan legges til i en senere versjon.
              </p>
            ) : (
              <div className="space-y-4">
                {avvikItems.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-md p-4">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Avvik #{index + 1}
                        </p>
                        <p className="text-xs text-gray-500">Fyll inn relevante detaljer</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAvvik(item.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Fjern
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emne
                        </label>
                        <input
                          type="text"
                          value={item.emne}
                          onChange={(e) =>
                            setAvvikItems((prev) =>
                              prev.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, emne: e.target.value }
                                  : entry
                              )
                            )
                          }
                          placeholder="Kort overskrift"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Beskrivelse
                        </label>
                        <textarea
                          rows={3}
                          value={item.beskrivelse}
                          onChange={(e) =>
                            setAvvikItems((prev) =>
                              prev.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, beskrivelse: e.target.value }
                                  : entry
                              )
                            )
                          }
                          placeholder="Beskriv avviket"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setIsOpen(false)
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Lagrer...' : 'Lagre rapport'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function AccessTab({
  shelterId,
  members,
  invites,
  onInvite,
  isAdmin,
}: {
  shelterId: string
  members: ReturnType<typeof useShelterMembers>['data']
  invites: ReturnType<typeof useShelterInvites>['data']
  onInvite: () => void
  isAdmin: boolean
}) {
  const toggleStatus = useToggleMemberStatus()
  const deleteInvite = useDeleteInvite()
  const { showToast } = useToast()

  const handleToggleStatus = async (memberId: string, currentStatus: boolean, memberName: string) => {
    try {
      await toggleStatus.mutateAsync({
        memberId,
        isActive: !currentStatus,
      })
      showToast(
        currentStatus
          ? `${memberName} sin tilgang er nå låst`
          : `${memberName} sin tilgang er gjenopprettet`,
        currentStatus ? 'info' : 'success'
      )
    } catch (err) {
      showToast(`Kunne ikke oppdatere tilgang: ${(err as Error).message}`, 'error')
    }
  }

  const handleDeleteInvite = async (inviteId: string, phoneNumber: string) => {
    try {
      await deleteInvite.mutateAsync({ inviteId, shelterId })
      showToast(`Invitasjon til ${formatPhoneNumber(phoneNumber) || phoneNumber} er slettet`, 'success')
    } catch (err) {
      showToast(`Kunne ikke slette invitasjon: ${(err as Error).message}`, 'error')
    }
  }

  // Filter pending invites
  const pendingInvites = invites?.filter((invite) => invite.status === 'pending') ?? []

  return (
    <div className="space-y-6">
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Medlemmer</h2>
        <button
          onClick={onInvite}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Inviter medlem
        </button>
      </div>

      {!members || members.length === 0 ? (
        <div className="p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Ingen medlemmer ennå.</p>
          <button
            onClick={onInvite}
            className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:underline"
          >
            <UserPlus className="w-4 h-4" />
            Inviter det første medlemmet
          </button>
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bruker
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                E-post
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Telefon
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invitert av
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Handlinger
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <span className="font-medium text-gray-900">
                    {member.profile?.first_name} {member.profile?.last_name}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {member.profile?.email || '-'}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {member.profile?.phone || '-'}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {member.inviter
                    ? `${member.inviter.first_name} ${member.inviter.last_name}`
                    : '-'}
                </td>
                <td className="px-6 py-4">
                  {member.is_active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Aktiv
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Låst
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(
                        member.id,
                        member.is_active,
                        `${member.profile?.first_name || ''} ${member.profile?.last_name || ''}`.trim() || 'Bruker'
                      )}
                      disabled={toggleStatus.isPending}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded text-sm ${
                        member.is_active
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      } disabled:opacity-50`}
                    >
                      {member.is_active ? (
                        <>
                          <Lock className="w-3 h-3" />
                          Lås
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3" />
                          Lås opp
                        </>
                      )}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {/* Pending Invitations - Admin only */}
    {isAdmin && pendingInvites.length > 0 && (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            Ventende invitasjoner
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">
              {pendingInvites.length}
            </span>
          </h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Telefonnummer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invitert av
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dato
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Handlinger
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pendingInvites.map((invite) => (
              <tr key={invite.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <span className="font-medium text-gray-900">
                    {formatPhoneNumber(invite.phone_number) || invite.phone_number}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {invite.inviter
                    ? `${invite.inviter.first_name} ${invite.inviter.last_name}`
                    : '-'}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {invite.created_at
                    ? new Date(invite.created_at).toLocaleDateString('nb-NO')
                    : '-'}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    Venter
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleDeleteInvite(invite.id, invite.phone_number)}
                    disabled={deleteInvite.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Slett
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    </div>
  )
}

function InviteModal({
  shelterId,
  onClose,
}: {
  shelterId: string
  onClose: () => void
}) {
  const [phone, setPhone] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const inviteMutation = useInviteToShelter()
  const { showToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!phone || !isValidPhoneNumber(phone)) {
      setError('Vennligst skriv inn et gyldig telefonnummer')
      return
    }

    try {
      await inviteMutation.mutateAsync({
        shelterId,
        phoneNumber: phone,
      })
      showToast(`Invitasjon sendt til ${formatPhoneNumber(phone)}`, 'success')
      onClose()
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('tilfluktsrom_invites_shelter_phone_unique') || message.includes('duplicate')) {
        setError('Dette telefonnummeret er allerede invitert til dette tilfluktsrommet')
        showToast('Telefonnummeret er allerede invitert', 'error')
      } else if (message.includes('permission') || message.includes('policy')) {
        setError(message)
        showToast('Du har ikke tillatelse til å invitere brukere til dette tilfluktsrommet', 'error')
      } else {
        setError(message)
        showToast(`Kunne ikke sende invitasjon: ${message}`, 'error')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Inviter medlem
        </h2>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Telefonnummer
          </label>
          <div className="mb-4">
            <PhoneInput
              international
              defaultCountry="NO"
              value={phone}
              onChange={setPhone}
              className="phone-input-container"
            />
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Brukeren vil få tilgang til dette tilfluktsrommet når de logger inn med dette telefonnummeret.
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
              type="submit"
              disabled={inviteMutation.isPending || !phone}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {inviteMutation.isPending ? 'Inviterer...' : 'Send invitasjon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
