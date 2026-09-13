import { cn } from '@/lib/utils'

type ShelterStatus = 'operational' | 'maintenance_req' | 'critical' | 'closed'

interface ShelterStatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<
  ShelterStatus,
  { label: string; className: string }
> = {
  operational: {
    label: 'Operativ',
    className: 'bg-green-100 text-green-800',
  },
  maintenance_req: {
    label: 'Vedlikehold krevet',
    className: 'bg-amber-100 text-amber-800',
  },
  critical: {
    label: 'Kritisk',
    className: 'bg-red-100 text-red-800',
  },
  closed: {
    label: 'Stengt',
    className: 'bg-gray-100 text-gray-800',
  },
}

export default function ShelterStatusBadge({
  status,
  className,
}: ShelterStatusBadgeProps) {
  const config = statusConfig[status as ShelterStatus] || statusConfig.operational

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      <span
        className={cn('w-1.5 h-1.5 rounded-full mr-1.5', {
          'bg-green-500': status === 'operational',
          'bg-amber-500': status === 'maintenance_req',
          'bg-red-500': status === 'critical',
          'bg-gray-500': status === 'closed',
        })}
      />
      {config.label}
    </span>
  )
}
