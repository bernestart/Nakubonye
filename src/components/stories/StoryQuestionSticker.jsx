import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { Send, CheckCircle2 } from "lucide-react"

export default function StoryQuestionSticker({ question, storyId, myId }) {
  const [answer, setAnswer] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!question || !question.prompt) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!answer.trim() || !myId || !storyId) return
    setLoading(true)
    const { error } = await supabase.from("story_questions").insert({ story_id: storyId, sender_id: myId, response_text: answer.trim() })
    setLoading(false)
    if (!error) setSubmitted(true)
  }

  return (
    <div data-nk-tap-ignore className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-center z-30 px-4 pointer-events-auto">
      <div className="w-full max-w-[320px] bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col items-center">
        
        <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-full grid place-items-center mb-3">
          <span className="text-white text-xl font-bold">?</span>
        </div>

        <h3 className="text-white text-center font-bold text-[17px] mb-4 leading-tight">{question.prompt}</h3>

        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle2 size={32} className="text-green-500" />
            <p className="text-white/60 font-medium text-sm">Response sent!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full flex items-center bg-white/5 rounded-full px-4 py-1 border border-white/10">
            <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer..." className="flex-1 bg-transparent text-white text-[14px] outline-none placeholder-gray-500 py-2" maxLength={150} />
            <button type="submit" disabled={!answer.trim() || loading} className="p-1.5 text-blue-400 disabled:opacity-50"><Send size={18} /></button>
          </form>
        )}
      </div>
    </div>
  )
}
