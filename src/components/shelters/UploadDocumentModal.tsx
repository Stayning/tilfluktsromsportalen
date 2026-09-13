import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import {
  useUploadShelterDocument,
  useReplaceShelterDocument,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_SHELTER,
  type ShelterDocument,
} from '@/hooks/useShelters'
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  type DocumentTypeValue,
} from '@/lib/documentTypes'

export default function UploadDocumentModal({
  shelterId,
  onClose,
  replacing,
  currentCount,
}: {
  shelterId: string
  onClose: () => void
  replacing?: ShelterDocument
  currentCount: number
}) {
  const uploadMutation = useUploadShelterDocument()
  const replaceMutation = useReplaceShelterDocument()
  const { showToast } = useToast()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<DocumentTypeValue>(
    replacing
      ? (replacing.document_type as DocumentTypeValue)
      : DOCUMENT_TYPES[0].value,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isPending = uploadMutation.isPending || replaceMutation.isPending
  const capReached = !replacing && currentCount >= MAX_DOCUMENTS_PER_SHELTER

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_DOCUMENT_BYTES) {
      showToast('Filen er for stor. Maks 10 MB.', 'error')
      e.target.value = ''
      return
    }
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    try {
      if (replacing) {
        const result = await replaceMutation.mutateAsync({
          shelterId,
          file: selectedFile,
          existing: replacing,
        })
        showToast(
          result.oldRemoved
            ? 'Dokumentet ble erstattet.'
            : 'Dokumentet ble erstattet, men gammel fil kunne ikke slettes fra lagring.',
          result.oldRemoved ? 'success' : 'error',
        )
      } else {
        if (capReached) {
          showToast('Maks 40 filer per tilfluktsrom.', 'error')
          return
        }
        await uploadMutation.mutateAsync({
          shelterId,
          file: selectedFile,
          documentType,
        })
        showToast('Dokumentet ble lastet opp.', 'success')
      }
      onClose()
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Feil ved opplasting av dokument.'
      showToast(message, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {replacing ? 'Erstatt dokument' : 'Last opp dokument'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dokumenttype
            </label>
            {replacing ? (
              <p className="text-sm text-gray-900 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                {documentTypeLabel(replacing.document_type as DocumentTypeValue)}
              </p>
            ) : (
              <select
                value={documentType}
                onChange={e => setDocumentType(e.target.value as DocumentTypeValue)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isPending}
              >
                {DOCUMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fil</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              disabled={isPending || capReached}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">Maks 10 MB per fil.</p>
            {capReached && (
              <p className="mt-1 text-xs text-red-600">
                Maks 40 filer er nådd. Slett et eksisterende dokument før du laster opp et nytt.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isPending || capReached}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            {isPending
              ? replacing
                ? 'Erstatter...'
                : 'Laster opp...'
              : replacing
                ? 'Erstatt'
                : 'Last opp'}
          </button>
        </div>
      </div>
    </div>
  )
}
