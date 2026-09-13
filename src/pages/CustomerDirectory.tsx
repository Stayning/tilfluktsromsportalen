import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import { useCreateCustomer, useCustomers, useUpdateCustomer } from '@/hooks/useShelters'
import { useToast } from '@/contexts/ToastContext'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Search, Plus, Briefcase, Pencil } from 'lucide-react'
import type { Kunde } from '@/types/database.types'

interface CustomerFormValues {
  navn: string
  nummer: string
  orgnr: string
  aktiv: boolean
}

const emptyForm: CustomerFormValues = {
  navn: '',
  nummer: '',
  orgnr: '',
  aktiv: true,
}

export default function CustomerDirectory() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Kunde | null>(null)
  const navigate = useNavigate()

  const { data: customers, isLoading, error } = useCustomers()
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const { showToast } = useToast()

  const filteredCustomers = useMemo(() => {
    if (!customers) return []
    if (!searchTerm) return customers

    const searchLower = searchTerm.toLowerCase()
    return customers.filter((customer) =>
      customer.navn?.toLowerCase().includes(searchLower) ||
      customer.nummer?.toString().includes(searchTerm) ||
      customer.orgnr?.toLowerCase().includes(searchLower)
    )
  }, [customers, searchTerm])

  const stats = useMemo(() => {
    const total = customers?.length || 0
    const active = customers?.filter((c) => c.aktiv !== false).length || 0
    return { total, active, inactive: total - active }
  }, [customers])

  const openNewCustomer = () => {
    setEditingCustomer(null)
    setIsModalOpen(true)
  }

  const openEditCustomer = (customer: Kunde) => {
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const openCustomerDetail = (customerId: number) => {
    navigate(`/admin/kunder/${customerId}`)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCustomer(null)
  }

  const handleSaveCustomer = async (values: CustomerFormValues) => {
    const trimmedName = values.navn.trim()
    if (!trimmedName) {
      throw new Error('Kundenavn er påkrevd')
    }

    const parsedNumber = Number(values.nummer)
    if (!values.nummer.trim() || Number.isNaN(parsedNumber)) {
      throw new Error('Kundenummer må være et gyldig tall')
    }

    const payload = {
      navn: trimmedName,
      nummer: parsedNumber,
      orgnr: values.orgnr.trim() || null,
      aktiv: values.aktiv,
    }

    try {
      if (editingCustomer) {
        await updateCustomer.mutateAsync({ id: editingCustomer.id, data: payload })
        showToast(`Oppdaterte ${trimmedName}`, 'success')
      } else {
        await createCustomer.mutateAsync({ id: parsedNumber, ...payload })
        showToast(`Opprettet ${trimmedName}`, 'success')
      }
      handleCloseModal()
    } catch (err) {
      const message = (err as Error).message
      showToast(`Kunne ikke lagre kunde: ${message}`, 'error')
      throw err
    }
  }

  const isSaving = createCustomer.isPending || updateCustomer.isPending

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-6 h-6" />
              Kunder
            </h1>
            <p className="text-gray-600 mt-1">
              Administrer kunder som benyttes i vurderinger og eiendomsdata.
            </p>
          </div>
          <button
            onClick={openNewCustomer}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ny kunde
          </button>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Søk etter kundenavn, nummer eller org.nr..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Totalt kunder</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Aktive kunder</p>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Inaktive kunder</p>
            <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={7} columns={4} />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {error ? (
              <div className="p-8 text-center text-red-600">
                Feil ved lasting av kunder: {(error as Error).message}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Ingen kunder funnet.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kunde
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kundenr.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Org.nr
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Handlinger
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openCustomerDetail(customer.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{customer.navn}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {customer.nummer ?? '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {customer.orgnr || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {customer.aktiv === false ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inaktiv
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Aktiv
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditCustomer(customer)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded text-sm text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="w-3 h-3" />
                          Rediger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          onClose={handleCloseModal}
          onSave={handleSaveCustomer}
          isSaving={isSaving}
        />
      )}
    </AppLayout>
  )
}

function CustomerModal({
  customer,
  onClose,
  onSave,
  isSaving,
}: {
  customer: Kunde | null
  onClose: () => void
  onSave: (values: CustomerFormValues) => Promise<void>
  isSaving: boolean
}) {
  const [formData, setFormData] = useState<CustomerFormValues>(() => {
    if (!customer) return { ...emptyForm }

    return {
      navn: customer.navn || '',
      nummer: customer.nummer?.toString() || '',
      orgnr: customer.orgnr || '',
      aktiv: customer.aktiv !== false,
    }
  })
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof CustomerFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'aktiv' ? e.target.checked : e.target.value
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      await onSave(formData)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {customer ? 'Rediger kunde' : 'Ny kunde'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kundenavn <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.navn}
                onChange={handleChange('navn')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kundenummer <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nummer}
                onChange={handleChange('nummer')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Org.nr
              </label>
              <input
                type="text"
                value={formData.orgnr}
                onChange={handleChange('orgnr')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="kunde-aktiv"
                type="checkbox"
                checked={formData.aktiv}
                onChange={handleChange('aktiv')}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="kunde-aktiv" className="text-sm text-gray-700">
                Aktiv kunde
              </label>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Lagrer...' : 'Lagre kunde'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
