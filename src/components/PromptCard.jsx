import { PROMPT_LIBRARY } from '../lib/profileLabels'

export function promptLabel(key) {
  const def = PROMPT_LIBRARY.find((p) => p.key === key)
  return def?.label || key
}

export function PromptList({ prompts }) {
  if (!Array.isArray(prompts) || prompts.length === 0) return null

  return (
    <div className="px-5 mt-6">
      <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
        Get to know me
      </p>
      <div className="flex flex-col gap-2.5">
        {prompts.map((p, i) => (
          <div
            key={p.prompt_key || i}
            className="rounded-2xl p-4 border border-purple-500/25"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(236,72,153,0.06) 100%)',
            }}
          >
            <p className="text-purple-300 text-[11.5px] font-bold tracking-wide mb-1.5">
              {promptLabel(p.prompt_key)}
            </p>
            <p className="text-cream text-[15px] leading-[1.5] font-medium">
              {p.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
