import type { Vurdering } from '@/types/database.types'

// Canonical inspection-report statuses, stored lowercase and matched
// case-insensitively. This array's order is also the display / grouping order
// used across the app (list groups, dropdowns).
export const REPORT_STATUSES = [
  'opprettet',
  'påbegynt',
  'ferdigstilling',
  'gjennomført',
  'fullført',
] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  opprettet: 'Opprettet',
  påbegynt: 'Påbegynt',
  ferdigstilling: 'Ferdigstilling',
  gjennomført: 'Gjennomført',
  fullført: 'Fullført',
}

// Ready-made options for status <select> dropdowns.
export const REPORT_STATUS_OPTIONS = REPORT_STATUSES.map((value) => ({
  value,
  label: REPORT_STATUS_LABELS[value],
}))

const REPORT_STATUS_SET: ReadonlySet<string> = new Set(REPORT_STATUSES)

export function isReportStatus(value: string): value is ReportStatus {
  return REPORT_STATUS_SET.has(value)
}

// Remove PostgreSQL composite/enum cast syntax, e.g. "('opprettet'::status_enum)".
export function cleanStatus(status: string | null | undefined): string | null {
  if (!status) return null
  if (status.startsWith('(') && status.includes('::')) {
    const inner = status.slice(1, status.indexOf('::'))
    return inner.replace(/^'|'$/g, '')
  }
  return status
}

// Cleaned + lowercased + trimmed value, for case-insensitive matching.
export function normalizeStatus(status: string | null | undefined): string | null {
  const cleaned = cleanStatus(status)
  if (!cleaned) return null
  return cleaned.toLowerCase().trim()
}

// Display label for a status, falling back to a capitalized version of the raw
// (cleaned) value for legacy/unrecognized statuses.
export function reportStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeStatus(status)
  if (!normalized) return ''
  if (isReportStatus(normalized)) return REPORT_STATUS_LABELS[normalized]
  const cleaned = cleanStatus(status) as string
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

// Badge colors for a report status, matched case-insensitively.
export function reportStatusBadgeClass(status: string | null | undefined): string {
  switch (normalizeStatus(status)) {
    case 'fullført':
    case 'gjennomført':
      return 'bg-green-100 text-green-800'
    case 'påbegynt':
    case 'ferdigstilling':
      return 'bg-amber-100 text-amber-800'
    default: // opprettet and anything unrecognized
      return 'bg-gray-100 text-gray-800'
  }
}

export interface ReportStatusGroup {
  key: string // normalized canonical status, or 'annet'
  label: string
  badgeClass: string
  reports: Vurdering[]
}

// Group reports by status into ordered, non-empty buckets: the canonical
// statuses first (in REPORT_STATUSES order), then an "Annet" bucket collecting
// any legacy/unrecognized or missing status.
export function groupReportsByStatus(reports: Vurdering[]): ReportStatusGroup[] {
  const byStatus = new Map<string, Vurdering[]>()
  for (const report of reports) {
    const normalized = normalizeStatus(report.status)
    const key = normalized && isReportStatus(normalized) ? normalized : 'annet'
    const bucket = byStatus.get(key)
    if (bucket) bucket.push(report)
    else byStatus.set(key, [report])
  }

  const groups: ReportStatusGroup[] = []
  for (const status of REPORT_STATUSES) {
    const bucket = byStatus.get(status)
    if (bucket && bucket.length > 0) {
      groups.push({
        key: status,
        label: REPORT_STATUS_LABELS[status],
        badgeClass: reportStatusBadgeClass(status),
        reports: bucket,
      })
    }
  }

  const annet = byStatus.get('annet')
  if (annet && annet.length > 0) {
    groups.push({
      key: 'annet',
      label: 'Annet',
      badgeClass: reportStatusBadgeClass('annet'),
      reports: annet,
    })
  }

  return groups
}
