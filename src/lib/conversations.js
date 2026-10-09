import { supabase } from './supabase'

// Find or create the canonical conversation between the current user
// and another user. Mirrors Chat.jsx lookup order so both entry points
// (Chat, StoryViewer) always agree on which conversation to use.
export async function findOrCreateConversation(otherUserId) {
  if (!otherUserId) return null
  const { data: { user } } = await supabase.auth.getUser()
  const myId = user?.id
  if (!myId || myId === otherUserId) return null

  const lo = myId < otherUserId ? myId : otherUserId
  const hi = myId < otherUserId ? otherUserId : myId
  const pairOr = `and(initiator_id.eq.${myId},recipient_id.eq.${otherUserId}),and(initiator_id.eq.${otherUserId},recipient_id.eq.${myId})`

  const { data: match } = await supabase
    .from('matches').select('id')
    .eq('user_one_id', lo).eq('user_two_id', hi)
    .maybeSingle()

  if (match) {
    const { data: existing } = await supabase
      .from('conversations').select('id')
      .eq('match_id', match.id).maybeSingle()
    if (existing) return existing.id

    const { data: directToAdopt } = await supabase
      .from('conversations').select('id')
      .eq('is_direct', true).or(pairOr)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    if (directToAdopt) {
      await supabase.from('conversations')
        .update({ match_id: match.id }).eq('id', directToAdopt.id)
      return directToAdopt.id
    }

    const { data: created, error } = await supabase
      .from('conversations').insert({ match_id: match.id })
      .select('id').single()
    if (error) {
      const { data: retry } = await supabase
        .from('conversations').select('id')
        .eq('match_id', match.id).maybeSingle()
      return retry?.id || null
    }
    return created?.id || null
  }

  let directId = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: directConvs } = await supabase
      .from('conversations').select('id')
      .eq('is_direct', true).or(pairOr)
      .order('created_at', { ascending: false })
      .limit(1)
    if (directConvs && directConvs.length > 0) { directId = directConvs[0].id; break }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 600))
  }
  if (directId) return directId

  const { data: allowed } = await supabase.rpc('can_send_message', {
    sender: myId, recipient: otherUserId,
  })
  if (allowed === false) return null

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ match_id: null, initiator_id: myId, recipient_id: otherUserId, is_direct: true })
    .select('id').single()
  if (error || !created) return null
  return created.id
}
