import type { ReactNode } from 'react'

type StateMessageProps = { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }

/** Shared layout for empty and error states. */
export function StateMessage({ icon, title, children, action }: StateMessageProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-accent-soft text-accent [&_svg]:size-5">{icon}</div>
      <p className="text-[15px] font-medium text-hi">{title}</p>
      {children && <div className="mt-1 max-w-[30ch] text-[13px] leading-5 text-mid">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
