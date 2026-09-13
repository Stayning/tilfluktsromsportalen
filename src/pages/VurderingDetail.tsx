import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  useVurdering,
  useVurderingAvvik,
  useShelter,
  useUpdateVurdering,
  useUpdateAvvik,
  useVurderingNotater,
  useVurderingObservasjoner,
  useVurderingTilstand,
  useKontaktperson,
  useSjekkliste,
  useForskriftInnhold,
} from '@/hooks/useShelters'
import type { SjekklisteItem, ForskriftInnhold } from '@/hooks/useShelters'
import { useAuth } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  ChevronLeft,
  FileText,
  Building2,
  Calendar,
  User,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Pencil,
  Save,
  X,
  Eye,
  MinusCircle,
} from 'lucide-react'
import { compareChecklistItemIds } from '@/lib/checklistSort'
import type { Avvik } from '@/types/database.types'
import PhotoGallery from '@/components/shelters/PhotoGallery'
import {
  cleanStatus,
  normalizeStatus,
  isReportStatus,
  reportStatusBadgeClass,
  reportStatusLabel,
  REPORT_STATUS_OPTIONS,
} from '@/lib/reportStatus'

type ChecklistRow = { checklist_item_id: string | null }

type CategoryBucket<T> = {
  groupId: number | 'other'
  groupTitle: string
  items: { itemId: string; rows: T[] }[]
}

function filterVisible<T extends ChecklistRow>(
  rows: T[],
  sjekklisteMap: Map<string, SjekklisteItem>,
  hasSjekkliste: boolean,
): T[] {
  if (!hasSjekkliste) return rows
  return rows.filter((r) => !r.checklist_item_id || sjekklisteMap.has(r.checklist_item_id))
}

function groupByCategory<T extends ChecklistRow>(
  rows: T[],
  sjekklisteMap: Map<string, SjekklisteItem>,
  hasSjekkliste: boolean,
): CategoryBucket<T>[] {
  if (!hasSjekkliste) {
    const flat: Record<string, T[]> = {}
    for (const r of rows) {
      const key = r.checklist_item_id || 'other'
      ;(flat[key] ||= []).push(r)
    }
    const items = Object.keys(flat)
      .filter((k) => k !== 'other')
      .sort(compareChecklistItemIds)
      .map((k) => ({ itemId: k, rows: flat[k] }))
    if (flat.other) items.push({ itemId: 'other', rows: flat.other })
    if (items.length === 0) return []
    return [{ groupId: 'other', groupTitle: '', items }]
  }

  const buckets = new Map<
    number | 'other',
    { groupId: number | 'other'; groupTitle: string; items: Record<string, T[]> }
  >()
  for (const row of rows) {
    const id = row.checklist_item_id
    if (id) {
      const sjekk = sjekklisteMap.get(id)
      if (!sjekk) continue
      const key = sjekk.group_id
      if (!buckets.has(key)) {
        buckets.set(key, { groupId: key, groupTitle: sjekk.group_title, items: {} })
      }
      ;(buckets.get(key)!.items[id] ||= []).push(row)
    } else {
      if (!buckets.has('other')) {
        buckets.set('other', { groupId: 'other', groupTitle: 'Annet', items: { other: [] } })
      }
      buckets.get('other')!.items.other.push(row)
    }
  }
  return [...buckets.values()]
    .sort((a, b) => {
      if (a.groupId === 'other') return 1
      if (b.groupId === 'other') return -1
      return (a.groupId as number) - (b.groupId as number)
    })
    .map((b) => {
      const itemKeys = Object.keys(b.items)
        .filter((k) => k !== 'other')
        .sort(compareChecklistItemIds)
      if (b.items.other) itemKeys.push('other')
      return {
        groupId: b.groupId,
        groupTitle: b.groupTitle,
        items: itemKeys.map((k) => ({ itemId: k, rows: b.items[k] })),
      }
    })
}

const STATUS_STYLES: Record<string, string> = {
  ok:              'bg-green-100 text-green-800',
  godkjent:        'bg-green-100 text-green-800',
  avvik:           'bg-red-100 text-red-800',
  observasjon:     'bg-amber-100 text-amber-800',
  'ikke-relevant': 'bg-gray-100 text-gray-600',
  ikke_relevant:   'bg-gray-100 text-gray-600',
  mangler:         'bg-orange-100 text-orange-800',
}

const statusStyle = (s: string) =>
  STATUS_STYLES[s.toLowerCase().trim()] ?? 'bg-blue-100 text-blue-800'

const StatusIcon = ({ status }: { status: string }) => {
  const key = status.toLowerCase().trim()
  if (key === 'ok' || key === 'godkjent') return <CheckCircle className="w-3 h-3" />
  if (key === 'avvik') return <AlertTriangle className="w-3 h-3" />
  if (key === 'observasjon') return <Eye className="w-3 h-3" />
  if (key === 'ikke-relevant' || key === 'ikke_relevant') return <MinusCircle className="w-3 h-3" />
  return null
}

const formatDateInput = (value: string | null) => {
  if (!value) return ''
  return value.length >= 10 ? value.slice(0, 10) : value
}

interface ReportDraft {
  status: string
  kontrolldato: string
  skjema: string
  tilstandGodkjent: string
  tilstandVurdering: string
}

interface AvvikDraft {
  emne: string
  beskrivelse: string
}

interface VurderingDetailProps {
  // Where the user navigated from — controls the breadcrumb. 'shelter' (default)
  // shows the Tilfluktsrom trail; 'rapporter' shows the Inspeksjonsrapporter trail.
  from?: 'shelter' | 'rapporter'
}

export default function VurderingDetail({ from = 'shelter' }: VurderingDetailProps) {
  const { id } = useParams<{ id: string }>()
  const { isAdmin } = useAuth()
  const { data: vurdering, isLoading, error } = useVurdering(id)
  const { data: avvikList } = useVurderingAvvik(id)
  const { data: shelter } = useShelter(vurdering?.tilfluktsrom ?? undefined)
  const updateVurdering = useUpdateVurdering()
  const updateAvvik = useUpdateAvvik()
  const { data: notaterList } = useVurderingNotater(id)
  const { data: observasjonerList } = useVurderingObservasjoner(id)
  const { data: tilstandList } = useVurderingTilstand(id)
  const { data: kontaktperson } = useKontaktperson(vurdering?.kontaktperson_id)
  const forskriftYear = shelter?.forskrift ?? null
  const { data: sjekklisteItems, isLoading: sjekklisteLoading } = useSjekkliste(forskriftYear)

  const sjekklisteMap = new Map<string, SjekklisteItem>()
  if (sjekklisteItems) {
    for (const item of sjekklisteItems) {
      sjekklisteMap.set(item.item_id, item)
    }
  }

  const allForskriftRefs = sjekklisteItems
    ? [...new Set(sjekklisteItems.flatMap((i) => i.forskrift_refs))]
    : []
  const { data: forskriftData } = useForskriftInnhold(forskriftYear, allForskriftRefs)
  const forskriftMap = new Map<string, ForskriftInnhold>()
  if (forskriftData) {
    for (const f of forskriftData) {
      forskriftMap.set(f.punkt, f)
    }
  }

  const [isEditingReport, setIsEditingReport] = useState(false)
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [editingAvvikId, setEditingAvvikId] = useState<string | null>(null)
  const [avvikDraft, setAvvikDraft] = useState<AvvikDraft | null>(null)
  const [avvikError, setAvvikError] = useState<string | null>(null)

  const startEditReport = () => {
    if (!vurdering) return
    setReportDraft({
      status: normalizeStatus(vurdering.status) || '',
      kontrolldato: formatDateInput(vurdering.kontrolldato),
      skjema: vurdering.skjema || '',
      tilstandGodkjent:
        vurdering.godkjent === undefined || vurdering.godkjent === null
          ? ''
          : vurdering.godkjent
          ? 'true'
          : 'false',
      tilstandVurdering: vurdering.tilstandsvurdering || '',
    })
    setReportError(null)
    setIsEditingReport(true)
  }

  const cancelEditReport = () => {
    setIsEditingReport(false)
    setReportDraft(null)
    setReportError(null)
  }

  const handleSaveReport = async () => {
    if (!vurdering || !reportDraft) return
    setReportError(null)

    const godkjent =
      reportDraft.tilstandGodkjent === ''
        ? null
        : reportDraft.tilstandGodkjent === 'true'

    try {
      await updateVurdering.mutateAsync({
        id: vurdering.id,
        data: {
          status: reportDraft.status.trim() || null,
          kontrolldato: reportDraft.kontrolldato || null,
          skjema: reportDraft.skjema.trim() || null,
          godkjent,
          tilstandsvurdering: reportDraft.tilstandVurdering.trim() || null,
        },
      })
      setIsEditingReport(false)
      setReportDraft(null)
    } catch (err) {
      setReportError((err as Error).message)
    }
  }

  const startEditAvvik = (avvik: Avvik) => {
    setEditingAvvikId(avvik.id)
    setAvvikDraft({
      emne: avvik.emne || '',
      beskrivelse: avvik.beskrivelse || '',
    })
    setAvvikError(null)
  }

  const cancelEditAvvik = () => {
    setEditingAvvikId(null)
    setAvvikDraft(null)
    setAvvikError(null)
  }

  const handleSaveAvvik = async (avvikId: string) => {
    if (!avvikDraft) return
    setAvvikError(null)

    try {
      await updateAvvik.mutateAsync({
        id: avvikId,
        data: {
          emne: avvikDraft.emne.trim(),
          beskrivelse: avvikDraft.beskrivelse.trim(),
        },
      })
      setEditingAvvikId(null)
      setAvvikDraft(null)
    } catch (err) {
      setAvvikError((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Skeleton className="h-64 w-full" />
            </div>
            <div>
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !vurdering) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-red-600">
            {error ? (error as Error).message : 'Rapport ikke funnet'}
          </div>
          <div className="text-center mt-4">
            {from === 'rapporter' ? (
              <Link to="/inspeksjonsrapporter" className="text-blue-600 hover:underline">
                ← Tilbake til inspeksjonsrapporter
              </Link>
            ) : (
              <Link to="/tilfluktsrom" className="text-blue-600 hover:underline">
                ← Tilbake til tilfluktsrom
              </Link>
            )}
          </div>
        </div>
      </AppLayout>
    )
  }

  const status = cleanStatus(vurdering.status)
  // Treat the sjekkliste as available only when the query has actually
  // succeeded. On error we fall through to unfiltered (flat) rendering so
  // the report still renders if the RPC is unavailable.
  const hasSjekkliste = !!sjekklisteItems

  const visibleAvvik = filterVisible(avvikList ?? [], sjekklisteMap, hasSjekkliste)
  const visibleObservasjoner = filterVisible(observasjonerList ?? [], sjekklisteMap, hasSjekkliste)
  const visibleNotater = filterVisible(notaterList ?? [], sjekklisteMap, hasSjekkliste)
  const visibleTilstand = filterVisible(tilstandList ?? [], sjekklisteMap, hasSjekkliste)

  const avvikBuckets = groupByCategory(visibleAvvik, sjekklisteMap, hasSjekkliste)
  const observasjonerBuckets = groupByCategory(visibleObservasjoner, sjekklisteMap, hasSjekkliste)
  const notaterBuckets = groupByCategory(visibleNotater, sjekklisteMap, hasSjekkliste)
  const tilstandBuckets = groupByCategory(visibleTilstand, sjekklisteMap, hasSjekkliste)

  const emneOptions = Array.from(new Set((avvikList || []).map((a) => a.emne).filter(Boolean) as string[]))
  // Canonical status options, plus the report's own value if it's a legacy /
  // unrecognized status, so editing never silently drops it.
  const draftStatus = reportDraft?.status ?? ''
  const statusOptions =
    draftStatus && !isReportStatus(draftStatus)
      ? [{ value: draftStatus, label: reportStatusLabel(draftStatus) }, ...REPORT_STATUS_OPTIONS]
      : REPORT_STATUS_OPTIONS
  const displayStatus = isEditingReport ? reportDraft?.status || '' : status
  const displayKontrolldato = isEditingReport
    ? reportDraft?.kontrolldato || null
    : vurdering.kontrolldato

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <datalist id="avvik-emne-options">
          {emneOptions.map((emne) => (
            <option key={emne} value={emne} />
          ))}
        </datalist>
        {/* Breadcrumb */}
        <nav className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {from === 'rapporter' ? (
              <>
                <Link to="/inspeksjonsrapporter" className="hover:text-gray-700">
                  Inspeksjonsrapporter
                </Link>
                <span>›</span>
                <span className="text-gray-900">Rapport #{vurdering.id}</span>
              </>
            ) : (
              <>
                <Link to="/tilfluktsrom" className="hover:text-gray-700">
                  Tilfluktsrom
                </Link>
                <span>›</span>
                {shelter ? (
                  <>
                    <Link
                      to={`/tilfluktsrom/${shelter.id}`}
                      className="hover:text-gray-700"
                    >
                      {shelter.alias || shelter.kundenavn || shelter.id}
                    </Link>
                    <span>›</span>
                  </>
                ) : null}
                <span className="text-gray-900">{vurdering.id}</span>
              </>
            )}
          </div>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Rapport #{vurdering.id}
              </h1>
              {displayStatus && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${reportStatusBadgeClass(displayStatus)}`}>
                  {reportStatusLabel(displayStatus)}
                </span>
              )}
            </div>
            {displayKontrolldato && (
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Inspisert {new Date(displayKontrolldato).toLocaleDateString()}
              </p>
            )}
            {shelter && (
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <Link
                  to={`/tilfluktsrom/${shelter.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {shelter.alias || shelter.kundenavn || shelter.id}
                </Link>
              </p>
            )}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {isEditingReport ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveReport}
                    disabled={updateVurdering.isPending}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {updateVurdering.isPending ? 'Lagrer...' : 'Lagre'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditReport}
                    disabled={updateVurdering.isPending}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60"
                  >
                    <X className="w-4 h-4" />
                    Avbryt
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEditReport}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Rediger rapport"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {reportError && (
          <div className="mb-4 text-sm text-red-600">
            {reportError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* General Conditions / Executive Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Generell tilstand
              </h2>

              {isEditingReport ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Rapportstatus
                      </label>
                      <select
                        value={reportDraft?.status || ''}
                        onChange={(e) =>
                          setReportDraft((prev) =>
                            prev ? { ...prev, status: e.target.value } : prev
                          )
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Velg status</option>
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Godkjenning
                      </label>
                      <select
                        value={reportDraft?.tilstandGodkjent || ''}
                        onChange={(e) =>
                          setReportDraft((prev) =>
                            prev ? { ...prev, tilstandGodkjent: e.target.value } : prev
                          )
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Ikke satt</option>
                        <option value="true">Godkjent</option>
                        <option value="false">Ikke godkjent</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Sammendrag
                    </label>
                    <textarea
                      value={reportDraft?.tilstandVurdering || ''}
                      onChange={(e) =>
                        setReportDraft((prev) =>
                          prev ? { ...prev, tilstandVurdering: e.target.value } : prev
                        )
                      }
                      rows={4}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Skriv inn vurdering..."
                    />
                  </div>
                </div>
              ) : (vurdering.godkjent !== null || vurdering.tilstandsvurdering) ? (
                <div className="space-y-4">
                  {vurdering.godkjent !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Status:</span>
                      {vurdering.godkjent ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          Godkjent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="w-4 h-4" />
                          Ikke godkjent
                        </span>
                      )}
                    </div>
                  )}
                  {vurdering.tilstandsvurdering && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        Sammendrag
                      </h3>
                      <p className="text-gray-700 bg-gray-50 p-4 rounded-md">
                        {vurdering.tilstandsvurdering}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Ingen tilstandsvurdering tilgjengelig.</p>
              )}
            </div>

            {/* Tilstand section */}
            {!sjekklisteLoading && visibleTilstand.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Tilstand per sjekkpunkt ({visibleTilstand.length})
                </h2>
                <div className="space-y-6">
                  {tilstandBuckets.map((bucket) => (
                    <div key={bucket.groupId}>
                      {bucket.groupTitle && (
                        <h3 className="text-base font-semibold text-gray-900 mb-3">
                          {bucket.groupTitle}
                        </h3>
                      )}
                      <div className="space-y-1">
                        {bucket.items.flatMap(({ rows }) => rows).map((t) => {
                          const sjekkItem = sjekklisteMap.get(t.checklist_item_id)
                          return (
                            <details key={t.id} className="group border-b last:border-0">
                              <summary className="flex items-start gap-3 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-gray-700">
                                    {sjekkItem
                                      ? sjekkItem.item_title
                                      : `Punkt ${t.checklist_item_id}`}
                                  </span>
                                  {sjekkItem && sjekkItem.forskrift_refs.length > 0 && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      (§ {sjekkItem.forskrift_refs.join(', ')})
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 flex-shrink-0">
                                  {t.status.map((s) => (
                                    <span
                                      key={s}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${statusStyle(s)}`}
                                    >
                                      <StatusIcon status={s} />
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </summary>
                              {sjekkItem && sjekkItem.forskrift_refs.length > 0 && (
                                <div className="pb-3 pl-0 space-y-2">
                                  {sjekkItem.forskrift_refs.map((ref) => {
                                    const f = forskriftMap.get(ref)
                                    if (!f) return null
                                    return (
                                      <div key={ref} className="bg-blue-50 rounded-md p-3 text-sm">
                                        <div className="font-medium text-blue-800 mb-1">§ {ref}</div>
                                        <div
                                          className="text-blue-900/80 prose prose-sm max-w-none [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:mb-1 [&_h6]:text-xs [&_h6]:font-medium [&_h6]:mb-1 [&_p]:mb-2 [&_ul]:mb-2 [&_li]:mb-0.5 [&_.kommentar]:text-blue-700/70 [&_.kommentar]:italic [&_.forskrift]:font-medium"
                                          dangerouslySetInnerHTML={{ __html: f.innhold }}
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </details>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Avvik (Deviations) grouped by category */}
            {!sjekklisteLoading && avvikBuckets.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Avvik ({visibleAvvik.length})
                </h2>

                <div className="space-y-6">
                  {avvikBuckets.map((bucket) => (
                    <div key={bucket.groupId}>
                      {bucket.groupTitle && (
                        <h3 className="text-base font-semibold text-gray-900 mb-3">
                          {bucket.groupTitle}
                        </h3>
                      )}
                      <div className="space-y-5">
                        {bucket.items.map(({ itemId, rows: items }) => {
                          const sjekk = sjekklisteMap.get(itemId)
                          const heading =
                            itemId === 'other'
                              ? 'Annet'
                              : sjekk
                              ? sjekk.item_title
                              : `Punkt ${itemId}`
                          return (
                    <div key={itemId}>
                      <h4 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">
                        {heading}
                        <span className="ml-2 text-sm text-gray-500">
                          ({items.length})
                        </span>
                      </h4>
                      <div className="space-y-3">
                        {items.map((avvik, index) => {
                          const isEditingAvvik = editingAvvikId === avvik.id
                          const currentDraft = isEditingAvvik ? avvikDraft : null

                          return (
                            <div key={avvik.id} className="bg-gray-50 rounded-md overflow-hidden">
                              <div className="flex items-start gap-4 p-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center text-sm font-medium">
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {avvik.emne && (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                                        {avvik.emne}
                                      </span>
                                    )}
                                  </div>
                                  {avvik.beskrivelse && (
                                    <p className="text-gray-600 text-sm">
                                      {avvik.beskrivelse}
                                    </p>
                                  )}
                                  {avvik.photo_ids && avvik.photo_ids.length > 0 && id && (
                                    <PhotoGallery vurderingId={id} photoIds={avvik.photo_ids} />
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isAdmin && (
                                    <>
                                      {isEditingAvvik ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleSaveAvvik(avvik.id)
                                            }}
                                            disabled={updateAvvik.isPending}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                                          >
                                            <Save className="w-3 h-3" />
                                            {updateAvvik.isPending ? 'Lagrer' : 'Lagre'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              cancelEditAvvik()
                                            }}
                                            disabled={updateAvvik.isPending}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60"
                                          >
                                            <X className="w-3 h-3" />
                                            Avbryt
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            startEditAvvik(avvik)
                                          }}
                                          className="p-1 text-gray-400 hover:text-gray-600"
                                          aria-label="Rediger avvik"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {isEditingAvvik && currentDraft && (
                                <div className="px-3 pb-3 pt-2 border-t border-gray-200 bg-white">
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Emne
                                      </label>
                                      <input
                                        type="text"
                                        list="avvik-emne-options"
                                        value={currentDraft.emne}
                                        onChange={(e) =>
                                          setAvvikDraft((prev) =>
                                            prev ? { ...prev, emne: e.target.value } : prev
                                          )
                                        }
                                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Beskrivelse
                                      </label>
                                      <textarea
                                        value={currentDraft.beskrivelse}
                                        onChange={(e) =>
                                          setAvvikDraft((prev) =>
                                            prev ? { ...prev, beskrivelse: e.target.value } : prev
                                          )
                                        }
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                  {avvikError && (
                                    <div className="mt-2 text-xs text-red-600">
                                      {avvikError}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observasjoner section */}
            {!sjekklisteLoading && observasjonerBuckets.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Observasjoner ({visibleObservasjoner.length})
                </h2>
                <div className="space-y-6">
                  {observasjonerBuckets.map((bucket) => (
                    <div key={bucket.groupId}>
                      {bucket.groupTitle && (
                        <h3 className="text-base font-semibold text-gray-900 mb-3">
                          {bucket.groupTitle}
                        </h3>
                      )}
                      <div className="space-y-5">
                        {bucket.items.map(({ itemId, rows: items }) => {
                          const sjekk = sjekklisteMap.get(itemId)
                          const heading =
                            itemId === 'other'
                              ? 'Annet'
                              : sjekk
                              ? sjekk.item_title
                              : `Punkt ${itemId}`
                          return (
                            <div key={itemId}>
                              <h4 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">
                                {heading}
                                <span className="ml-2 text-sm text-gray-500">({items.length})</span>
                              </h4>
                              <div className="space-y-3">
                                {items.map((obs) => (
                                  <div key={obs.id} className="bg-gray-50 rounded-md p-3">
                                    {obs.emne && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                        {obs.emne}
                                      </span>
                                    )}
                                    {obs.beskrivelse && (
                                      <p className="text-gray-600 text-sm mt-1">{obs.beskrivelse}</p>
                                    )}
                                    {obs.photo_ids && obs.photo_ids.length > 0 && id && (
                                      <PhotoGallery vurderingId={id} photoIds={obs.photo_ids} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notater section */}
            {!sjekklisteLoading && notaterBuckets.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notater ({visibleNotater.length})
                </h2>
                <div className="space-y-6">
                  {notaterBuckets.map((bucket) => (
                    <div key={bucket.groupId}>
                      {bucket.groupTitle && (
                        <h3 className="text-base font-semibold text-gray-900 mb-3">
                          {bucket.groupTitle}
                        </h3>
                      )}
                      <div className="space-y-5">
                        {bucket.items.map(({ itemId, rows: items }) => {
                          const sjekk = sjekklisteMap.get(itemId)
                          const heading =
                            itemId === 'other'
                              ? 'Annet'
                              : sjekk
                              ? sjekk.item_title
                              : `Punkt ${itemId}`
                          return (
                            <div key={itemId}>
                              <h4 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">
                                {heading}
                                <span className="ml-2 text-sm text-gray-500">({items.length})</span>
                              </h4>
                              <div className="space-y-2">
                                {items.map((notat) => (
                                  <div key={notat.id} className="bg-gray-50 rounded-md p-3">
                                    <p className="text-gray-700 text-sm">{notat.notat}</p>
                                    {notat.photo_ids && notat.photo_ids.length > 0 && id && (
                                      <PhotoGallery vurderingId={id} photoIds={notat.photo_ids} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Details Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                Detaljer
              </h3>

              {isEditingReport ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">Skjematype</label>
                    <input
                      type="text"
                      value={reportDraft?.skjema || ''}
                      onChange={(e) =>
                        setReportDraft((prev) =>
                          prev ? { ...prev, skjema: e.target.value } : prev
                        )
                      }
                      className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Kontrolldato
                    </label>
                    <input
                      type="date"
                      value={reportDraft?.kontrolldato || ''}
                      onChange={(e) =>
                        setReportDraft((prev) =>
                          prev ? { ...prev, kontrolldato: e.target.value } : prev
                        )
                      }
                      className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Opprettet
                    </span>
                    <div className="mt-1 text-gray-900">
                      {new Date(vurdering.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ) : (
                <dl className="space-y-4">
                  {shelter?.kundenavn && (
                    <div>
                      <dt className="text-sm text-gray-500 flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Kunde
                      </dt>
                      <dd className="mt-1 text-gray-900">{shelter.kundenavn}</dd>
                    </div>
                  )}

                  {shelter?.matrikkel && (
                    <div>
                      <dt className="text-sm text-gray-500 flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        Matrikkel
                      </dt>
                      <dd className="mt-1 text-gray-900">{shelter.matrikkel}</dd>
                    </div>
                  )}

                  {shelter?.adresse && (
                    <div>
                      <dt className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Adresse
                      </dt>
                      <dd className="mt-1 text-gray-900">
                        {typeof shelter.adresse === 'object' && shelter.adresse !== null && (
                          <>
                            {(shelter.adresse as Record<string, string>).gate && (
                              <div>{(shelter.adresse as Record<string, string>).gate}</div>
                            )}
                            {(shelter.adresse as Record<string, string>).sted && (
                              <div className="text-gray-600">{(shelter.adresse as Record<string, string>).sted}</div>
                            )}
                          </>
                        )}
                      </dd>
                    </div>
                  )}

                  {vurdering.skjema && (
                    <div>
                      <dt className="text-sm text-gray-500">Skjematype</dt>
                      <dd className="mt-1 text-gray-900">{vurdering.skjema}</dd>
                    </div>
                  )}

                  {shelter?.forskrift && (
                    <div>
                      <dt className="text-sm text-gray-500">Forskrift</dt>
                      <dd className="mt-1 text-gray-900">{shelter.forskrift}</dd>
                    </div>
                  )}

                  {vurdering.vurderingsnummer !== null && vurdering.vurderingsnummer !== undefined && (
                    <div>
                      <dt className="text-sm text-gray-500">Vurderingsnummer</dt>
                      <dd className="mt-1 text-gray-900">{vurdering.vurderingsnummer}</dd>
                    </div>
                  )}

                  {(vurdering.utførende || kontaktperson) && (
                    <div>
                      <dt className="text-sm text-gray-500 flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Utført av
                      </dt>
                      <dd className="mt-1 text-gray-900">
                        {kontaktperson ? (
                          <div>
                            <div>{kontaktperson.navn}</div>
                            {kontaktperson.telefon && (
                              <div className="text-sm text-gray-500">{kontaktperson.telefon}</div>
                            )}
                            {kontaktperson.epost && (
                              <div className="text-sm text-gray-500">{kontaktperson.epost}</div>
                            )}
                          </div>
                        ) : (
                          <div>{vurdering.utførende}</div>
                        )}
                      </dd>
                    </div>
                  )}

                  <div>
                    <dt className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Opprettet
                    </dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(vurdering.created_at).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            {/* Back to Shelter */}
            {shelter && (
              <Link
                to={`/tilfluktsrom/${shelter.id}`}
                className="flex items-center gap-2 text-blue-600 hover:underline"
              >
                <ChevronLeft className="w-4 h-4" />
                Tilbake til tilfluktsrom
              </Link>
            )}
          </div>
        </div>
      </div>

    </AppLayout>
  )
}
