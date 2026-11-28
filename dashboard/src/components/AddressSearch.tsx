import { MapPin, Search } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import type { GeocodeCandidate } from '@/api/types'
import { useAddressSearch } from '@/hooks/useAddressSearch'

type Props = {
  id: string
  /** What the dispatcher typed. */
  value: string
  onChange: (text: string) => void
  /** Called when the dispatcher picks a suggestion, which places the pin. */
  onPick: (candidate: GeocodeCandidate) => void
  invalid?: boolean
  placeholder?: string
}

/** An address field that suggests matching addresses below it, picked with the mouse or the arrow keys. */
export function AddressSearch({ id, value, onChange, onPick, invalid, placeholder }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const { data: candidates = [] } = useAddressSearch(value)
  const shown = open && value.trim().length >= 3 ? candidates : []
  const pick = (c: GeocodeCandidate) => {
    onPick(c)
    setOpen(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') return setOpen(false)
    if (!shown.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + shown.length) % shown.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(shown[Math.min(active, shown.length - 1)])
    }
  }
  return (
    <div>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown.length ? `${listId}-${Math.min(active, shown.length - 1)}` : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-inset pr-3 pl-9 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-[var(--border-strong)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Matching addresses" hidden={!shown.length} className="mt-1 overflow-hidden rounded-lg border bg-popover text-sm">
        {shown.map((c, i) => (
          <li
            key={c.address}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            // Keep focus in the field, so picking does not blur it and close the list first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(c)}
            onMouseEnter={() => setActive(i)}
            className="flex cursor-pointer items-center gap-2 px-3 py-2 aria-selected:bg-muted"
          >
            <MapPin aria-hidden="true" className={`size-4 shrink-0 ${i === active ? 'text-brand' : 'text-muted-foreground'}`} />
            {c.address}
          </li>
        ))}
      </ul>
    </div>
  )
}
