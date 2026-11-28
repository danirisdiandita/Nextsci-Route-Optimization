import type { OrderImportId } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { useOrderImport } from '@/features/stops/hooks/useOrderImport'

// Placeholder: the stops feature replaces this with the column matching step (design NM 04).
export function ImportMappingPage({ importId }: { importId: OrderImportId }) {
  const { data: orderImport, error } = useOrderImport(importId)
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Match your columns to Nextsci fields</h2>
      <p className="mt-1 text-muted-foreground">{orderImport && `${orderImport.fileName} · ${orderImport.rows.length} rows`}</p>
      <ErrorNotice error={error} className="mt-4" />
    </section>
  )
}
