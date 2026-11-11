export default function BenefitRow({ icon, title, description, danger }) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
        danger 
          ? 'bg-red-500/10 border-red-500/20 text-red-400' 
          : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-[15px] mb-1">{title}</h4>
        <p className="text-muted text-[13px] leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
