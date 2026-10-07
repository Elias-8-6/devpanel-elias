import type { ReactNode } from 'react'

export type BadgeTone = 'indigo' | 'sky' | 'slate' | 'emerald' | 'rose'

const TONES: Record<BadgeTone, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}

interface BadgeProps {
  tone: BadgeTone
  children: ReactNode
}

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
