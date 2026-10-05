// Content mixer with weighted ranking.
// score = recency × engagement × relationship × contentAffinity
// Facebook-style: interactions and preferences personalize the score.

function recencyWeight(createdAt) {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const hours = ageMs / (1000 * 60 * 60)
  if (hours < 6) return 1.5
  if (hours < 24) return 1.2
  return 1.0
}

function engagementWeight(item) {
  const likes = item._likeCount || 0
  const comments = item._commentCount || 0
  const views = item.view_count || 0
  return 1 + Math.log(1 + likes + 2 * comments + 0.05 * views)
}

// Relationship base — relationship TYPE (match/follow/stranger)
function relationshipBase(item, ctx) {
  if (!ctx) return 1
  const uid = item.author_id || item.user_id
  if (uid === ctx.myId) return 4
  if (ctx.matchIds?.has(uid)) return 3
  if (ctx.followIds?.has(uid)) return 2
  return 1
}

// Relationship strength — how often YOU actually interact with this author
// 0 interactions → 1x, 5 → 2x, 20 → 3x (log scale, capped)
function interactionBoost(item, ctx) {
  if (!ctx?.interactions) return 1
  const uid = item.author_id || item.user_id
  const n = ctx.interactions.get(uid) || 0
  if (n === 0) return 1
  return Math.min(3, 1 + Math.log(1 + n) * 0.6)
}

function relationshipWeight(item, ctx) {
  return relationshipBase(item, ctx) * interactionBoost(item, ctx)
}

// Content affinity — reel person or post person?
// affinity = 1.0 if balanced, up to 1.4 for your preferred type
function contentAffinityWeight(item, ctx) {
  if (!ctx?.reelAffinity) return 1
  const isReel = item._source === "reel"
  return isReel ? ctx.reelAffinity : (2 - ctx.reelAffinity) * 0.7 + 0.3
}

// Negative — hidden or snoozed author → suppress (should already be filtered)
function negativePenalty(item, ctx) {
  if (!ctx) return 1
  const uid = item.author_id || item.user_id
  if (ctx.hiddenAuthors?.has(uid)) return 0.3
  return 1
}

// Signal weights from actual user behavior (7A.4)
// ctx.signalScores: Map<"type:id", { dwell, skip, open, share, comment, like, impression, view }>
function behaviorBoost(item, ctx) {
  if (!ctx?.signalScores) return 1
  const key = (item._source || "personal") + ":" + item.id
  const sig = ctx.signalScores.get(key)
  if (!sig) return 1

  // Author-level affinity also contributes
  const author = item.author_id || item.user_id
  const authorSig = ctx.authorSignals?.get(author)

  let boost = 1

  // Positive signals
  if (sig.open)    boost += 0.4 * Math.min(3, sig.open)
  if (sig.share)   boost += 0.6 * Math.min(3, sig.share)
  if (sig.comment) boost += 0.5 * Math.min(3, sig.comment)
  if (sig.like)    boost += 0.3 * Math.min(5, sig.like)

  // Dwell time (capped)
  if (sig.dwell > 0) boost += Math.min(0.5, sig.dwell * 0.06)

  // Negative signals
  if (sig.skip) boost -= 0.15 * Math.min(4, sig.skip)
  if (sig.hide) boost *= 0.3

  // Author-level push
  if (authorSig) {
    if (authorSig.dwell > 0) boost += Math.min(0.4, authorSig.dwell * 0.04)
    if (authorSig.skip > authorSig.view) boost *= 0.7
  }

  return Math.max(0.2, Math.min(3.5, boost))
}

function scoreItem(item, ctx) {
  return (
    recencyWeight(item.created_at) *
    engagementWeight(item) *
    relationshipWeight(item, ctx) *
    contentAffinityWeight(item, ctx) *
    behaviorBoost(item, ctx) *
    negativePenalty(item, ctx)
  )
}

export function mixFeed({
  posts,
  reels,
  pageSize = 20,
  reelEvery = 10,
  seenReelIds,
  scoreContext,
}) {
  const out = []

  const postsSorted = scoreContext
    ? [...posts].sort((a, b) => scoreItem(b, scoreContext) - scoreItem(a, scoreContext))
    : posts

  const reelsSorted = scoreContext
    ? [...reels].sort((a, b) => scoreItem(b, scoreContext) - scoreItem(a, scoreContext))
    : reels

  let postIdx = 0
  let reelIdx = 0

  // Do NOT tail-dump reels when posts run out
  while (out.length < pageSize && postIdx < postsSorted.length) {
    let postsTaken = 0
    while (postsTaken < reelEvery - 1 && postIdx < postsSorted.length && out.length < pageSize) {
      out.push(postsSorted[postIdx++])
      postsTaken++
    }
    while (reelIdx < reelsSorted.length && out.length < pageSize) {
      const r = reelsSorted[reelIdx++]
      if (seenReelIds && seenReelIds.has(r.id)) continue
      if (seenReelIds) seenReelIds.add(r.id)
      out.push(r)
      break
    }
  }

  return out
}
