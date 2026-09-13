import { useSignedPhotoUrls } from '@/hooks/useShelters'
import { Skeleton } from '@/components/ui/Skeleton'

interface PhotoGalleryProps {
  vurderingId: string
  photoIds: string[] | null | undefined
}

export default function PhotoGallery({ vurderingId, photoIds }: PhotoGalleryProps) {
  const ids = photoIds ?? []
  const { data: photos, isLoading } = useSignedPhotoUrls(vurderingId, ids)

  if (ids.length === 0) return null

  if (isLoading) {
    return (
      <div className="flex gap-2 flex-wrap mt-2">
        {ids.map((id) => (
          <Skeleton key={id} className="w-20 h-20 rounded" />
        ))}
      </div>
    )
  }

  if (!photos || photos.length === 0) return null

  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {photos.map(({ photoId, signedUrl }) =>
        signedUrl ? (
          <a
            key={photoId}
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-20 h-20 rounded overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
          >
            <img
              src={signedUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </a>
        ) : null
      )}
    </div>
  )
}
