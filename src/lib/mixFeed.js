// Content mixer with weighted ranking.
// score = recency × engagement × relationship
// Rule: N-1 posts → 1 reel, but stop when posts are exhausted to prevent reel clustering.

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

function relationshipWeight(item, ctx) {
  if (!ctx) return 1
  const uid = item.author_id || item.user_id
  if (uid === ctx.myId) return 4
  if (ctx.matchIds && ctx.matchIds.has(uid)) return 3
  if (ctx.followIds && ctx.followIds.has(uid)) return 2
  return 1
}

function scoreItem(item, ctx) {
  return recencyWeight(item.created_at) * engagementWeight(item) * relationshipWeight(item, ctx)
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

  // Stop when posts run out — do NOT tail-dump reels
  while (out.length < pageSize && postIdx < postsSorted.length) {
    // Take up to (reelEvery - 1) posts
    let postsTaken = 0
    while (postsTaken < reelEvery - 1 && postIdx < postsSorted.length && out.length < pageSize) {
      out.push(postsSorted[postIdx++])
      postsTaken++
    }
    // Try to append 1 reel after the post batch
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
