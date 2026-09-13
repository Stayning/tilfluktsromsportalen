export const DOCUMENT_TYPES = [
  { value: 'drifts_og_klargjoringsinstruks', label: 'Drifts- og klargjøringsinstruks' },
  { value: 'betjeningsinstruks_ventilasjon', label: 'Betjeningsinstruks ventilasjon' },
  { value: 'annet', label: 'Annet' },
] as const

export type DocumentTypeValue = typeof DOCUMENT_TYPES[number]['value']
export const documentTypeLabel = (v: DocumentTypeValue) =>
  DOCUMENT_TYPES.find(t => t.value === v)?.label ?? v
