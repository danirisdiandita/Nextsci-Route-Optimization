import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { OrderField, OrderImport, OrderImportId } from '@/api/types'
import { orderFields } from '@/api/types'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ImportedRow, ImportResult } from '@/features/stops/api'
import { ImportSteps } from '@/features/stops/components/ImportSteps'
import { assignColumn, exampleValue, fieldOfColumn } from '@/features/stops/importMapping'
import { countByStatus, orderFieldLabel } from '@/features/stops/stopList'
import { useCommitOrderImport } from '@/features/stops/hooks/useCommitOrderImport'
import { useOrderImport } from '@/features/stops/hooks/useOrderImport'
import { useOrderImportPreview } from '@/features/stops/hooks/useOrderImportPreview'
import { useUpdateOrderImportMapping } from '@/features/stops/hooks/useUpdateOrderImportMapping'
import { useOrders } from '@/hooks/useOrders'
import { formatWindow } from '@/lib/time'

const NONE = 'none'
const fieldItems = [...orderFields.map((f) => ({ value: f as string, label: orderFieldLabel[f] })), { value: NONE, label: "Don't import" }]

/** Rows the import leaves out, numbered as in the spreadsheet, where the header is row 1. */
const skippedRows = (preview: ImportedRow[]) =>
  preview.flatMap((r, i) => (r.customer && r.addressRaw ? [] : [{ row: i + 2, problem: r.customer ? 'no address' : 'no customer name' }]))

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Step 2 of the import: say which column fills each stop field, check a few rows, then place the addresses. */
export function ImportMappingPage({ importId }: { importId: OrderImportId }) {
  const navigate = useNavigate()
  const { data: orderImport, error } = useOrderImport(importId)
  const { data: preview } = useOrderImportPreview(importId)
  const updateMapping = useUpdateOrderImportMapping()
  const commit = useCommitOrderImport()
  const [remember, setRemember] = useState(true)

  if (!orderImport) {
    return (
      <section className="mx-auto flex w-full max-w-[880px] flex-col gap-6 p-4 sm:p-6">
        <ImportSteps current={1} />
        {error ? <ErrorNotice error={error} /> : <Skeleton className="h-64" />}
      </section>
    )
  }

  const committed = orderImport.committedAt !== null
  const skipped = preview ? skippedRows(preview) : []
  const choose = (column: number, value: string | null) =>
    updateMapping.mutate({ importId, mapping: assignColumn(orderImport.mapping, column, value === NONE || value === null ? null : (value as OrderField)) })
  const findAddresses = () =>
    commit.mutate(
      { importId, rememberMapping: remember },
      {
        onSuccess: (result) => {
          toast.success(`Imported ${plural(result.orders.length, 'stop')}`, { description: resultLine(result) })
          void navigate({ to: '/stops/review' })
        },
      },
    )

  return (
    <section className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6 p-4 sm:p-6">
      <ImportSteps current={committed ? 2 : 1} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
        <FileSpreadsheet aria-hidden="true" className="size-4 text-[var(--success)]" />
        <span className="font-[560]">{orderImport.fileName}</span>
        <span className="text-muted-foreground">{`${orderImport.rows.length} rows · ${orderImport.columns.length} columns`}</span>
        {!committed && (
          <Link to="/stops/import" className="ml-auto text-brand">
            Replace file
          </Link>
        )}
      </div>

      {committed ? <ImportedSummary orderImport={orderImport} skipped={skipped} /> : null}

      <div className="grid gap-3">
        <h2 className="text-base font-semibold">Match your columns to Nextsci fields</h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Your column</TableHead>
                <TableHead className="max-sm:hidden">Example value</TableHead>
                <TableHead aria-hidden="true" className="w-8 max-sm:hidden" />
                <TableHead>Nextsci field</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderImport.columns.map((column, i) => {
                const field = fieldOfColumn(orderImport.mapping, i)
                return (
                  <TableRow key={i}>
                    <TableCell className="font-[560]">{column || `Column ${i + 1}`}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground max-sm:hidden">{exampleValue(orderImport.rows, i)}</TableCell>
                    <TableCell aria-hidden="true" className="text-muted-foreground max-sm:hidden">
                      <ArrowRight className="size-4" />
                    </TableCell>
                    <TableCell>
                      <Select items={fieldItems} value={field ?? NONE} disabled={committed || updateMapping.isPending} onValueChange={(v) => choose(i, v)}>
                        <SelectTrigger aria-label={`Nextsci field for ${column}`} className="w-[200px] max-sm:w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <ErrorNotice error={updateMapping.error} />
      </div>

      {!committed && preview && <ImportPreview rows={preview} skipped={skipped} />}

      {!committed && (
        <div className="flex items-center gap-2">
          <Checkbox id="remember-mapping" checked={remember} onCheckedChange={setRemember} />
          <Label htmlFor="remember-mapping" className="font-normal">
            Remember this mapping for the next import
          </Label>
        </div>
      )}
      <ErrorNotice error={commit.error} />

      <div className="mt-auto flex justify-between gap-3 pt-4">
        <Button variant="outline" nativeButton={false} render={<Link to={committed ? '/stops' : '/stops/import'} />}>
          Back
        </Button>
        {committed ? (
          <Button nativeButton={false} render={<Link to="/stops/review" />}>
            Review addresses
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button disabled={commit.isPending || updateMapping.isPending} onClick={findAddresses}>
            {commit.isPending ? 'Finding addresses' : 'Find addresses'}
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </section>
  )
}

function resultLine({ counts, skipped }: ImportResult) {
  const placed = `${counts.ok} placed, ${counts.check} to check, ${counts.not_found} not found`
  return skipped.length ? `${placed}. Skipped ${plural(skipped.length, 'row')}: ${skipped.map((s) => `row ${s.row} (${s.problem})`).join(', ')}.` : `${placed}.`
}

/** The first rows as they will be saved, so a wrong column shows before anything is imported. */
function ImportPreview({ rows, skipped }: { rows: ImportedRow[]; skipped: { row: number; problem: string }[] }) {
  const problems = rows.filter((r) => r.problems.length).length
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Preview</h2>
        <p className="text-xs text-muted-foreground">
          {`${plural(rows.length - skipped.length, 'stop')} to import`}
          {skipped.length > 0 && ` · ${plural(skipped.length, 'row')} without a name or address will be skipped`}
          {problems > 0 && ` · ${plural(problems, 'row')} with a cell that could not be read`}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Window</TableHead>
              <TableHead className="text-right">Load</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 5).map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-[560]">{r.customer || <span className="text-[var(--danger-text)]">No name</span>}</TableCell>
                <TableCell className="max-w-[280px] truncate">{r.addressRaw || <span className="text-[var(--danger-text)]">No address</span>}</TableCell>
                <TableCell className="text-muted-foreground">{r.window ? formatWindow(r.window) : 'Any time'}</TableCell>
                <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {skipped.length > 0 && (
        <p className="text-xs text-muted-foreground">{`Skipped: ${skipped.map((s) => `row ${s.row} (${s.problem})`).join(', ')}.`}</p>
      )}
    </div>
  )
}

/** What a finished import made: its stops by address status, and the rows it left out. */
function ImportedSummary({ orderImport, skipped }: { orderImport: OrderImport; skipped: { row: number; problem: string }[] }) {
  const { data: orders } = useOrders()
  const mine = orders?.filter((o) => o.importId === orderImport.id) ?? []
  const counts = countByStatus(mine)
  return (
    <div role="status" className="grid gap-1 rounded-lg border bg-card px-4 py-3 text-sm">
      <p className="font-[560]">{`Imported ${plural(mine.length, 'stop')} from this file.`}</p>
      <p className="text-muted-foreground">
        {`${counts.ready} ready, ${counts.check} to check, ${counts.not_found} not found.`}
        {skipped.length > 0 && ` Skipped ${skipped.map((s) => `row ${s.row} (${s.problem})`).join(', ')}.`}
      </p>
    </div>
  )
}
