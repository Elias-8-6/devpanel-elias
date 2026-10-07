interface SpinnerProps {
  // Tailwind size utility, e.g. "size-4".
  size?: string
  // "light" for use on dark/colored backgrounds (buttons).
  tone?: 'default' | 'light'
}

const TONES = {
  default: 'border-slate-300 border-t-indigo-600',
  light: 'border-white/40 border-t-white',
}

export function Spinner({ size = 'size-5', tone = 'default' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block animate-spin rounded-full border-2 ${TONES[tone]} ${size}`}
    />
  )
}
