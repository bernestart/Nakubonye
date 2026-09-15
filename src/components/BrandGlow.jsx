// The one shared purple/pink ambient glow.
// Matches the base color and warmth used on Premium / Safety Center / Matches.
//
// Layer stack:
//   1. Full-screen purple BASE (fills the whole background with a purple undertone)
//   2. Top-center purple radial (behind the header/title area)
//   3. Bottom-right pink radial (warmth behind the primary button)
//   4. Bottom-left soft fuchsia (extra depth)

export default function BrandGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
    >
      {/* 1. BASE purple wash — the thing that makes the whole screen feel purple */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, #1A0B2E 0%, #150925 40%, #12071F 70%, #0E0519 100%)',
        }}
      />

      {/* 2. Top-center purple radial */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[620px] h-[520px] rounded-full bg-purple-600/32"
        style={{ filter: 'blur(130px)' }}
      />

      {/* 3. Bottom-right pink */}
      <div
        className="absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full bg-pink-500/22"
        style={{ filter: 'blur(120px)' }}
      />

      {/* 4. Bottom-left soft fuchsia */}
      <div
        className="absolute bottom-[-160px] left-[-120px] w-[380px] h-[380px] rounded-full bg-purple-500/16"
        style={{ filter: 'blur(130px)' }}
      />
    </div>
  )
}
