export function Button({ children, variant = 'primary', className = '', ...rest }) {
  const base =
    'w-full rounded-full py-[15px] font-bold text-[16px] transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
  const styles = {
    primary: 'bg-purple-600 text-white hover:bg-purple-500',
    secondary: 'bg-elevated text-cream border border-line hover:bg-surface',
    ghost: 'bg-transparent text-muted hover:text-cream',
  }
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-[13px] font-semibold text-muted mb-2">
          {label}
        </span>
      )}
      {children}
      {hint && <span className="block text-[12px] text-subtle mt-2">{hint}</span>}
    </label>
  )
}

export function Input(props) {
  return (
    <input
      {...props}
      className="w-full bg-elevated border border-line rounded-2xl px-4 py-3.5 text-cream text-[15px] placeholder:text-subtle focus:outline-none focus:border-purple-500 transition-colors"
    />
  )
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className="w-full bg-elevated border border-line rounded-2xl px-4 py-3.5 text-cream text-[15px] placeholder:text-subtle focus:outline-none focus:border-purple-500 transition-colors resize-none"
    />
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-2xl bg-purple-600 grid place-items-center shadow-[0_8px_24px_rgba(124,58,237,0.4)]">
        <span className="text-white font-black text-xl">N</span>
      </div>
      <span className="text-cream font-bold text-[17px] tracking-tight">
        Nakubonye
      </span>
    </div>
  )
}
