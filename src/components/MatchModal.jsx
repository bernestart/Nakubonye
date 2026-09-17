import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Heart } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"

function MatchModal({ me, them, onClose, onMessage }) {
  const [resolvedMyPhoto, setResolvedMyPhoto] = useState(null)
  useEffect(() => {
    if (!me?.id || me?.photo_url) return
    let cancelled = false
    supabase
      .from('profile_photos')
      .select('storage_path')
      .eq('user_id', me.id)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.storage_path) {
          setResolvedMyPhoto(publicPhotoUrl(data.storage_path))
        }
      })
    return () => { cancelled = true }
  }, [me?.id, me?.photo_url])

  const myPhoto = me?.photo_url || resolvedMyPhoto
  const theirPhoto = them?.photo_url
  const myInitial = (me?.display_name || 'Y')[0].toUpperCase()
  const theirInitial = (them?.display_name || 'T')[0].toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 grid place-items-center px-5"
      style={{ background: 'rgba(11,11,20,0.92)', backdropFilter: 'blur(14px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className="w-full max-w-[380px] relative"
      >
        {/* Outer glow */}
        <div className="absolute -inset-8 pointer-events-none">
          <div className="absolute inset-0 rounded-full bg-purple-600/35 blur-[80px]" />
          <div className="absolute inset-x-8 bottom-0 top-1/3 rounded-full bg-pink-500/25 blur-[70px]" />
        </div>

        <div className="relative bg-surface rounded-[28px] p-6 pt-7 text-center border border-purple-500/30 shadow-[0_30px_100px_rgba(124,58,237,0.55)] overflow-hidden">
          {/* Radial highlight */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 0%, rgba(124,58,237,0.28) 0%, transparent 65%)' }}
          />

          <div className="relative">
            <p className="text-purple-300 text-[11px] font-black tracking-[0.18em] uppercase mb-1.5">
              ✨ It's a match ✨
            </p>
            <h2 className="text-cream text-[26px] leading-[1.1] font-extrabold tracking-tight mb-6">
              You got a match!
            </h2>

            {/* Two tilted photo cards */}
            <div className="relative flex items-center justify-center h-[180px] mb-7">
              {/* My photo — tilted left, behind */}
              <div
                className="absolute left-[10%] w-[122px] h-[154px] rounded-[20px] overflow-hidden border-[3px] border-white shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
                style={{ transform: 'rotate(-9deg)' }}
              >
                {myPhoto ? (
                  <img src={myPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-3xl font-black text-purple-400 bg-purple-600/30">
                    {myInitial}
                  </div>
                )}
              </div>

              {/* Their photo — tilted right, in front */}
              <div
                className="absolute right-[10%] w-[122px] h-[154px] rounded-[20px] overflow-hidden border-[3px] border-white shadow-[0_18px_50px_rgba(0,0,0,0.7)] z-10"
                style={{ transform: 'rotate(9deg)' }}
              >
                {theirPhoto ? (
                  <img src={theirPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-3xl font-black text-purple-400 bg-purple-600/30">
                    {theirInitial}
                  </div>
                )}
              </div>

              {/* Heart badge in center */}
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute z-20 w-12 h-12 rounded-full grid place-items-center border-4 border-surface"
                style={{
                  background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                  boxShadow: '0 12px 30px rgba(236,72,153,0.7)',
                }}
              >
                <Heart size={20} strokeWidth={0} fill="white" className="text-white" />
              </motion.div>
            </div>

            <button
              onClick={onMessage}
              className="w-full h-12 rounded-full text-white font-bold text-[15px] mb-1.5"
              style={{
                background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                boxShadow: '0 12px 32px rgba(236,72,153,0.5)',
              }}
            >
              Send a message
            </button>
            <button
              onClick={onClose}
              className="w-full h-11 text-muted font-semibold text-[14px] hover:text-cream"
            >
              Keep swiping
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default MatchModal
