// Wraps an avatar (or any circular element) with a tier-colored ring.
// tier: 'standard' | 'pro' | 'creator'
//
// Standard  → no ring (clean, default)
// Pro       → purple-pink gradient ring
// Creator   → gold-pink gradient ring with a subtle glow

export default function TierRing({ tier = 'standard', size = 48, children, className = '' }) {
  const isPro = tier === 'pro'
  const isCreator = tier === 'creator'

  // Standard = plain wrapper, no ring
  if (!isPro && !isCreator) {
    return (
      <div className={className} style={{ width: size, height: size }}>
        {children}
      </div>
    )
  }

  const padding = 3
  const gradient = isCreator
    ? 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)'
    : 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)'
  const glow = isCreator
    ? '0 0 14px rgba(245,158,11,0.55)'
    : '0 0 10px rgba(168,85,247,0.45)'

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '999px',
        padding,
        background: gradient,
        boxShadow: glow,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '999px',
          overflow: 'hidden',
          background: '#0B0B14',
        }}
      >
        {children}
      </div>
    </div>
  )
}
