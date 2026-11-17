const fs = require('fs');
const p = 'src/screens/CreatorMode.jsx';
let s = fs.readFileSync(p, 'utf8');
let n = 0;
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); console.error(JSON.stringify(find.slice(0,150))); process.exit(1); }
  s = s.replace(find, replace); console.log('✅', label); n++;
}

// 1. Add state to main component
apply(
`  const [showConfirmOff, setShowConfirmOff] = useState(false)`,
`  const [showConfirmOff, setShowConfirmOff] = useState(false)
  const [category, setCategory] = useState('')
  const [showCategorySheet, setShowCategorySheet] = useState(false)`,
'add category state');

// 2. Load category_label alongside account_type
apply(
`        const { data } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', myId)
          .maybeSingle()
        if (!cancelled) setAccountType(data?.account_type || 'personal')`,
`        const { data } = await supabase
          .from('profiles')
          .select('account_type, category_label')
          .eq('id', myId)
          .maybeSingle()
        if (!cancelled) {
          setAccountType(data?.account_type || 'personal')
          setCategory(data?.category_label || '')
        }`,
'load category_label');

// 3. Save handler
apply(
`  async function turnOff() {`,
`  async function saveCategory(value) {
    if (!myId) return
    setCategory(value)
    setShowCategorySheet(false)
    tap('medium')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ category_label: value })
        .eq('id', myId)
      if (error) throw error
    } catch (e) {
      console.warn('save category failed', e)
      alert('Could not save category: ' + (e.message || e))
    }
  }

  async function turnOff() {`,
'saveCategory handler');

// 4. Pass props to ActiveView
apply(
`        {isCreator ? (
          <ActiveView onTurnOff={() => setShowConfirmOff(true)} />
        ) : (`,
`        {isCreator ? (
          <ActiveView
            onTurnOff={() => setShowConfirmOff(true)}
            category={category}
            onEditCategory={() => setShowCategorySheet(true)}
          />
        ) : (`,
'ActiveView props');

// 5. Render picker sheet alongside confirm-off
apply(
`      {showConfirmOff && (
        <ConfirmOff
          busy={busy}
          onCancel={() => setShowConfirmOff(false)}
          onConfirm={turnOff}
        />
      )}`,
`      {showConfirmOff && (
        <ConfirmOff
          busy={busy}
          onCancel={() => setShowConfirmOff(false)}
          onConfirm={turnOff}
        />
      )}

      {showCategorySheet && (
        <CategorySheet
          current={category}
          onSelect={saveCategory}
          onCancel={() => setShowCategorySheet(false)}
        />
      )}`,
'category sheet render');

// 6. ActiveView signature — add props
apply(
`function ActiveView({ onTurnOff }) {`,
`function ActiveView({ onTurnOff, category, onEditCategory }) {`,
'ActiveView signature');

// 7. Insert category row after the "Coming soon" card
apply(
`      <button
        onClick={onTurnOff}
        className="w-full h-12 rounded-full bg-white/[0.06] border border-white/12 text-cream font-semibold text-[14px]"
      >
        Turn off creator mode
      </button>`,
`      <button
        onClick={onEditCategory}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/8 mb-3 active:bg-white/[0.05]"
      >
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center text-purple-300">
            <Tag size={16} />
          </span>
          <span className="flex flex-col items-start">
            <span className="text-cream font-semibold text-[13.5px]">Category</span>
            <span className="text-muted text-[11.5px]">{category || 'Choose what best describes you'}</span>
          </span>
        </span>
        <ChevronRight size={16} className="text-muted" />
      </button>

      <button
        onClick={onTurnOff}
        className="w-full h-12 rounded-full bg-white/[0.06] border border-white/12 text-cream font-semibold text-[14px]"
      >
        Turn off creator mode
      </button>`,
'category row on ActiveView');

// 8. Add Tag + ChevronRight to lucide imports (via our shim)
apply(
`import { ArrowLeft, Sparkles, Users, BarChart3, Tag, Check } from 'lucide-react'`,
`import { ArrowLeft, Sparkles, Users, BarChart3, Tag, Check, ChevronRight } from 'lucide-react'`,
'imports ChevronRight');

// 9. Append CategorySheet component at end of file
s = s.trimEnd() + `

const CREATOR_CATEGORIES = [
  'Digital Creator',
  'Public Figure',
  'Artist',
  'Musician / Band',
  'Writer',
  'Filmmaker',
  'Photographer',
  'Entrepreneur',
  'Business',
  'Community Leader',
  'Educator',
  'Other',
]

function CategorySheet({ current, onSelect, onCancel }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: '80dvh' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-4" />
        <div className="px-5 pb-3 border-b border-white/8">
          <h3 className="text-cream font-extrabold text-[16px]">Category</h3>
          <p className="text-muted text-[12.5px] mt-1 leading-snug">
            Choose the category that best describes your profile. It appears under your name.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {CREATOR_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => onSelect(c)}
              className={\`w-full flex items-center justify-between p-3.5 rounded-2xl text-left active:bg-white/[0.04] \${
                current === c ? 'bg-purple-500/10' : ''
              }\`}
            >
              <span className="text-cream text-[14px] font-medium">{c}</span>
              {current === c && (
                <span className="w-5 h-5 rounded-full bg-purple-500 grid place-items-center">
                  <Check size={12} className="text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="px-5 pt-3 pb-4 border-t border-white/8"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onCancel}
            className="w-full h-11 text-muted font-semibold text-[13.5px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
`;
console.log('✅ CategorySheet appended');

fs.writeFileSync(p, s);
console.log(`\n✅ CreatorMode.jsx — ${n} edits applied`);
