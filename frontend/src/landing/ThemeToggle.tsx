import { type ThemePreference, useTheme } from '../hooks/useTheme'
import { Icon } from './Icons'

const options: { value: ThemePreference; label: string; icon: 'monitor' | 'sun' | 'moon' }[] = [
  { value: 'system', label: 'System theme', icon: 'monitor' },
  { value: 'light', label: 'Light theme', icon: 'sun' },
  { value: 'dark', label: 'Dark theme', icon: 'moon' },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {options.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={preference === value}
          onClick={() => setPreference(value)}
        >
          <Icon name={icon} size={15} />
        </button>
      ))}
    </div>
  )
}
