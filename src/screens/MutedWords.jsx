import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, X, Trash2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"

export default function MutedWords() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [words, setWords] = useState([])
  const [newWord, setNewWord] = useState("")

  async function load() {
    if (!myId) return
    setLoading(true)
    const { data } = await supabase
      .from("muted_words")
      .select("id, word, created_at")
      .eq("user_id", myId)
      .order("created_at", { ascending: false })
    setWords(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [myId])

  async function add() {
    const w = newWord.trim().toLowerCase()
    if (!w || w.length < 2 || w.length > 60 || !myId) return
    if (words.some((x) => x.word.toLowerCase() === w)) { setNewWord(""); return }
    tap("light")
    setNewWord("")
    // Optimistic
    const temp = { id: "temp-" + crypto.randomUUID(), word: w, created_at: new Date().toISOString() }
    setWords((cur) => [temp, ...cur])
    const { data, error } = await supabase
      .from("muted_words")
      .insert({ user_id: myId, word: w })
      .select("id, word, created_at")
      .single()
    if (error) {
      setWords((cur) => cur.filter((x) => x.id !== temp.id))
    } else if (data) {
      setWords((cur) => cur.map((x) => x.id === temp.id ? data : x))
    }
  }

  async function remove(id) {
    tap("light")
    setWords((cur) => cur.filter((x) => x.id !== id))
    await supabase.from("muted_words").delete().eq("id", id).eq("user_id", myId)
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <AppHeader />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <button
            onClick={() => { tap("light"); nav(-1) }}
            className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.06] border border-white/10"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-cream" />
          </button>
          <h1 className="text-cream font-extrabold text-[16px]">Muted words</h1>
        </div>

        <div className="px-4 py-4">
          <p className="text-muted text-[12.5px] leading-relaxed mb-4">
            Posts and comments containing these words won't appear in your feeds. They'll still show up in the original place if you visit it directly.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value.slice(0, 60))}
              onKeyDown={(e) => { if (e.key === "Enter") add() }}
              placeholder="Add a word or phrase"
              className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/10 px-4 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={add}
              disabled={!newWord.trim() || newWord.trim().length < 2}
              className="w-11 h-11 rounded-full grid place-items-center text-white disabled:opacity-40 shrink-0"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
              aria-label="Add"
            >
              <Plus size={20} strokeWidth={2.6} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-2xl bg-white/[0.03] shimmer" />)}
            </div>
          ) : words.length === 0 ? (
            <div className="py-16 text-center px-4">
              <p className="text-[42px] mb-2">🤐</p>
              <p className="text-cream font-bold text-[14.5px] mb-1">No muted words yet</p>
              <p className="text-muted text-[12.5px]">Add words you'd rather not see.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {words.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 h-11 px-3 rounded-2xl bg-white/[0.03] border border-white/8"
                >
                  <span className="flex-1 text-cream text-[13.5px] truncate">{w.word}</span>
                  <button
                    onClick={() => remove(w.id)}
                    className="w-8 h-8 rounded-full grid place-items-center text-red-400/70 active:opacity-70"
                    aria-label="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
