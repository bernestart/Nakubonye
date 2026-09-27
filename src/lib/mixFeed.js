// Content mixer: 3 posts → 1 reel, repeat
// Keeps the feed from being dominated by a single content type.
export function mixFeed({ posts, reels, pageSize = 12, reelEvery = 4, seenReelIds }) {
  const out = []
  let postIdx = 0
  let reelIdx = 0

  while (out.length < pageSize) {
    // Take (reelEvery - 1) posts
    let postsTaken = 0
    while (postsTaken < reelEvery - 1 && postIdx < posts.length && out.length < pageSize) {
      out.push(posts[postIdx++])
      postsTaken++
    }
    // Take 1 reel (skip if already seen this session)
    while (reelIdx < reels.length && out.length < pageSize) {
      const r = reels[reelIdx++]
      if (seenReelIds && seenReelIds.has(r.id)) continue
      if (seenReelIds) seenReelIds.add(r.id)
      out.push(r)
      break
    }
    // Both exhausted
    if (postIdx >= posts.length && reelIdx >= reels.length) break
  }

  return out
}
