import type { IconName } from './content'

const paths: Record<IconName | 'github' | 'arrow' | 'check', string> = {
  route: 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4',
  phone: 'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3ZM11 18h2',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9ZM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0',
  chart: 'M4 20h16M7 16v-4M12 16V8M17 16v-7',
  calendar: 'M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11ZM5 10h14M9 3v4M15 3v4',
  server: 'M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v3A1.5 1.5 0 0 1 17.5 10h-11A1.5 1.5 0 0 1 5 8.5v-3ZM5 15.5A1.5 1.5 0 0 1 6.5 14h11a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-3ZM8 7h.01M8 17h.01',
  coins: 'M9 10c3 0 5.5-1.1 5.5-2.5S12 5 9 5 3.5 6.1 3.5 7.5 6 10 9 10ZM3.5 7.5v4C3.5 12.9 6 14 9 14s5.5-1.1 5.5-2.5v-4M14.5 11c3 0 6-1 6 2.5S18 16 15 16M3.5 11.5v4C3.5 16.9 6 18 9 18s5.5-1.1 5.5-2.5M20.5 13.5v4c0 1.4-2.5 2.5-5.5 2.5',
  code: 'M8.5 8 4.5 12l4 4M15.5 8l4 4-4 4M13.5 5l-3 14',
  github:
    'M12 3a9 9 0 0 0-2.85 17.54c.45.08.62-.2.62-.43v-1.6c-2.5.54-3.03-1.06-3.03-1.06-.41-1.04-1-1.32-1-1.32-.82-.56.06-.55.06-.55.9.07 1.38.93 1.38.93.8 1.38 2.11.98 2.62.75.08-.58.32-.98.57-1.2-2-.23-4.1-1-4.1-4.45 0-.98.35-1.79.93-2.42-.1-.23-.4-1.14.08-2.38 0 0 .76-.24 2.48.92a8.6 8.6 0 0 1 4.5 0c1.72-1.16 2.48-.92 2.48-.92.49 1.24.18 2.15.09 2.38.58.63.92 1.44.92 2.42 0 3.46-2.1 4.22-4.1 4.44.32.28.61.83.61 1.67v2.48c0 .24.16.52.62.43A9 9 0 0 0 12 3Z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5 9.5 17 19 7.5',
}

type Props = { name: keyof typeof paths; size?: number; className?: string }

export function Icon({ name, size = 16, className }: Props) {
  const filled = name === 'github'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#f7f8f8" />
      <path
        d="M9 22.5h7.5a3.25 3.25 0 0 0 0-6.5h-1a3.25 3.25 0 0 1 0-6.5H23"
        fill="none"
        stroke="#08090a"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="9" cy="22.5" r="2.6" fill="#08090a" />
      <circle cx="23" cy="9.5" r="2.6" fill="#5e9bff" />
    </svg>
  )
}
