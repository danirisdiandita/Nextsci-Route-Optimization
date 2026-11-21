import { Monitor, Moon, Sun } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type ThemePreference, useTheme } from '@/hooks/useTheme'

const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System theme', Icon: Monitor },
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme()
  return (
    <ToggleGroup
      aria-label="Theme"
      size="sm"
      spacing={0}
      className={className}
      value={[preference]}
      onValueChange={(value) => {
        const next = value[0] as ThemePreference | undefined
        if (next) setPreference(next)
      }}
    >
      {options.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} title={label} className="text-muted-foreground aria-pressed:text-foreground">
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
