// Purple + pink ambient glow that sits behind a screen.
// Sits absolutely positioned; parent must be position: relative/fixed with overflow hidden.
// `variant` controls intensity so each screen can have the right feel.

export default function GlowBackdrop({ variant = 'default' }) {
  const configs = {
    subtle: {
      purple: 'bg-purple-600/14',
      pink: 'bg-pink-500/8',
      blue: 'bg-fuchsia-500/6',
      blur: 130,
    },
    default: {
      purple: 'bg-purple-600/22',
      pink: 'bg-pink-500/14',
      blue: 'bg-fuchsia-500/10',
      blur: 120,
    },
    strong: {
      purple: 'bg-purple-600/30',
      pink: 'bg-pink-500/20',
      blue: 'bg-fuchsia-500/15',
      blur: 110,
    },
  }
  const c = configs[variant] || configs.default

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
    >
      <div
        className={`absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full ${c.purple}`}
        style={{ filter: `blur(${c.blur}px)` }}
      />
      <div
        className={`absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full ${c.pink}`}
        style={{ filter: `blur(${c.blur}px)` }}
      />
      <div
        className={`absolute bottom-[20%] left-[-140px] w-[320px] h-[320px] rounded-full ${c.blue}`}
        style={{ filter: `blur(${c.blur}px)` }}
      />
    </div>
  )
}
