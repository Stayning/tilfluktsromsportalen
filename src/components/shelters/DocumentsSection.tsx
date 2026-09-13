import { useState } from 'react'
import { FileText, Image as ImageIcon, Trash2, Upload, RefreshCw } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import {
  useShelterDocuments,
  useDeleteShelterDocument,
  getSignedDocumentUrl,
  MAX_DOCUMENTS_PER_SHELTER,
  type ShelterDocument,
} from '@/hooks/useShelters'
import { DOCUMENT_TYPES } from '@/lib/documentTypes'
import UploadDocumentModal from './UploadDocumentModal'

type UploadModalState =
  | { mode: 'new' }
  | { mode: 'replace'; document: ShelterDocument }
  | null

function sanitizeDisplayName(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/\s+/g, ' ').trim()
}

export default function DocumentsSection({
  shelterId,
  canManageDocuments,
}: {
  shelterId: string
  canManageDocuments: boolean
}) {
  const { data: documents, isLoading } = useShelterDocuments(shelterId)
  const deleteMutation = useDeleteShelterDocument()
  const { showToast } = useToast()
  const [uploadModal, setUploadModal] = useState<UploadModalState>(null)

  const handleDelete = async (doc: ShelterDocument) => {
    try {
      await deleteMutation.mutateAsync({ id: doc.id, filePath: doc.file_path, shelterId })
      showToast('Dokumentet ble slettet.', 'success')
    } catch {
      showToast('Feil ved sletting av dokument.', 'error')
    }
  }

  const handleOpen = async (filePath: string) => {
    try {
      const url = await getSignedDocumentUrl(filePath)
      window.open(url, '_blank')
    } catch {
      showToast('Kunne ikke åpne dokumentet.', 'error')
    }
  }

  const documentList = documents ?? []
  const totalCount = documentList.length
  const capReached = totalCount >= MAX_DOCUMENTS_PER_SHELTER
  const grouped = DOCUMENT_TYPES.map(({ value, label }) => ({
    type: value,
    label,
    docs: documentList.filter(d => d.document_type === value),
  })).filter(g => g.docs.length > 0)

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-semibold text-gray-900">Dokumenter</h3>
            {!isLoading && (
              <span className="text-xs text-gray-500">
                {totalCount} / {MAX_DOCUMENTS_PER_SHELTER} filer
              </span>
            )}
          </div>
          {canManageDocuments && (
            <button
              onClick={() => setUploadModal({ mode: 'new' })}
              disabled={capReached}
              title={capReached ? 'Maks 40 filer er nådd' : undefined}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              <Upload className="w-4 h-4" />
              Last opp
            </button>
          )}
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Laster...</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-gray-500">Ingen dokumenter lastet opp ennå.</p>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.type}>
                <h4 className="text-sm font-medium text-gray-700 mb-2">{group.label}</h4>
                <ul className="divide-y divide-gray-100">
                  {group.docs.map(doc => {
                    const isImage = doc.mime_type?.startsWith('image/') ?? false
                    const Icon = isImage ? ImageIcon : FileText
                    return (
                      <li key={doc.id} className="flex items-center gap-3 py-3">
                        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <button
                          onClick={() => handleOpen(doc.file_path)}
                          className="flex-1 text-left text-sm text-blue-600 hover:underline truncate"
                        >
                          {sanitizeDisplayName(doc.file_name)}
                        </button>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {doc.profiles
                            ? `${doc.profiles.first_name ?? ''} ${doc.profiles.last_name ?? ''}`.trim()
                            : '—'}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(doc.created_at).toLocaleDateString('nb-NO')}
                        </span>
                        {canManageDocuments && (
                          <>
                            <button
                              onClick={() => setUploadModal({ mode: 'replace', document: doc })}
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                              aria-label="Erstatt dokument"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Erstatt
                            </button>
                            <button
                              onClick={() => handleDelete(doc)}
                              disabled={deleteMutation.isPending}
                              className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                              aria-label="Slett dokument"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {uploadModal && (
        <UploadDocumentModal
          shelterId={shelterId}
          onClose={() => setUploadModal(null)}
          replacing={uploadModal.mode === 'replace' ? uploadModal.document : undefined}
          currentCount={totalCount}
        />
      )}
    </>
  )
}
