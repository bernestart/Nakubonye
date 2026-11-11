import { motion } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'

export default function CreatorStepLayout({ 
  title, step, totalSteps, onBack, onNext, onClose, children, isLast, nextText = "Next" 
}) {
  return (
    <div className="fixed inset-0 z-[400] bg-[#0B0B14] flex flex-col text-cream">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/8 bg-[#0B0B14] z-10">
        <button onClick={onBack} className="w-9 h-9 rounded-full grid place-items-center active:bg-white/10 transition-colors">
          {step > 0 ? <ArrowLeft size={20} /> : <div className="w-5" />}
        </button>
        <span className="font-bold text-[16px]">{title}</span>
        <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center active:bg-white/10 transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Scrollable Animated Content */}
      <div className="flex-1 overflow-y-auto relative">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="px-5 pt-6 pb-32"
        >
          {children}
        </motion.div>
      </div>

      {/* Bottom Bar */}
      <div className="px-5 pb-5 shrink-0 bg-[#0B0B14] border-t border-white/8 z-10" 
           style={{ paddingBottom: 'max(20px, var(--safe-bottom, 8px))' }}>
        {/* Progress Pills */}
        <div className="flex justify-center gap-1.5 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-purple-500' : 'w-1.5 bg-white/15'}`} />
          ))}
        </div>
        
        {/* Action Button */}
        <button onClick={onNext} className="w-full h-12 rounded-full text-white font-bold text-[15px] bg-gradient-to-r from-purple-600 to-pink-500 active:scale-[0.98] transition-transform">
          {isLast ? 'Finish' : nextText}
        </button>
      </div>
    </div>
  )
}
