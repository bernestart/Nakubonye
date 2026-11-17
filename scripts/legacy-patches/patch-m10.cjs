#!/usr/bin/env node
const fs = require('fs');

// --- 1. Patch ProfilePostCard (Add X / onHide) ---
const ppcFile = 'src/components/ProfilePostCard.jsx';
let ppc = fs.readFileSync(ppcFile, 'utf8');

ppc = ppc.replace(
  `export default function ProfilePostCard({ post, authorProfile, authorPhoto, isMe, onOpenMenu, reactionCount = 0, liked = false, reactionEmoji = "❤️", commentCount = 0, shareCount = 0, onToggleLike, onOpenReposts, topReactors = [] }) {`,
  `export default function ProfilePostCard({ post, authorProfile, authorPhoto, isMe, onOpenMenu, onHide, reactionCount = 0, liked = false, reactionEmoji = "❤️", commentCount = 0, shareCount = 0, onToggleLike, onOpenReposts, topReactors = [] }) {`
);

ppc = ppc.replace(
  `import { Heart, MessageCircle, Share2, MoreVertical, Globe, Users, Lock } from "lucide-react"`,
  `import { Heart, MessageCircle, Share2, MoreVertical, Globe, Users, Lock, X } from "lucide-react"`
);

ppc = ppc.replace(
  `        <button
          onClick={() => { tap("light"); onOpenMenu?.(post) }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="Post options"
        >
          <MoreVertical size={18} />
        </button>`,
  `        <button
          onClick={() => { tap("light"); onOpenMenu?.(post) }}
          className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="Post options"
        >
          <MoreVertical size={18} />
        </button>
        {onHide && (
          <button
            onClick={() => { tap("light"); onHide(post) }}
            className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
            aria-label="Hide post"
          >
            <X size={18} />
          </button>
        )}`
);

fs.writeFileSync(ppcFile, ppc);
console.log('✅ ProfilePostCard patched with X / onHide');


// --- 2. Patch CommunityFeed (Use ProfilePostCard) ---
const cfFile = 'src/components/CommunityFeed.jsx';
let cf = fs.readFileSync(cfFile, 'utf8');

cf = cf.replace(
  `import ResharedPost from './ResharedPost'`,
  `import ResharedPost from './ResharedPost'\nimport ProfilePostCard from './ProfilePostCard'`
);

const startStr = "{posts.map((post) => {";
const startIdx = cf.indexOf(startStr);
if (startIdx === -1) throw new Error("Map start not found in CommunityFeed");

let openBraces = 0;
let endIdx = -1;
for (let i = startIdx; i < cf.length; i++) {
  if (cf[i] === '{') openBraces++;
  if (cf[i] === '}') openBraces--;
  if (openBraces === 0) { endIdx = i + 1; break; }
}

if (endIdx === -1) throw new Error("Map end not found in CommunityFeed");
const oldMap = cf.slice(startIdx, endIdx);

const newMap = `{posts.map((post) => {
            const mine = post.author_id === session.user.id
            const postReacts = reactions[post.id] || []
            const myReact = postReacts.find(r => r.user_id === session.user.id)?.reaction
            const isAnn = !!post.is_announcement
            
            return (
              <div key={post.id} className={isAnn ? "rounded-2xl border border-pink-500/40 bg-pink-500/10 p-2 mb-2" : "mb-2"}>
                {isAnn && (
                  <div className="px-2 pt-2 flex items-center gap-2">
                    <span className="px-2 h-6 rounded-full bg-pink-500/25 border border-pink-500/50 text-pink-200 text-[10.5px] font-black tracking-wider flex items-center gap-1">📢 ANNOUNCEMENT</span>
                  </div>
                )}
                <ProfilePostCard
                  post={{
                    ...post,
                    _source: "community",
                    author_id: post.author_id,
                    content: post.content,
                    image_paths: post.image_paths || (post.image_path ? [post.image_path] : []),
                    audience: "public"
                  }}
                  authorProfile={{ id: post.author_id, display_name: post.author_name, is_verified: post.author_verified }}
                  authorPhoto={post.author_photo}
                  isMe={mine}
                  onOpenMenu={(p) => { /* open actions */ }}
                  onHide={(p) => { setMutedIds(prev => new Set(prev).add(p.author_id)) }}
                  reactionCount={postReacts.length}
                  liked={!!myReact}
                  reactionEmoji={myReact || "❤️"}
                  commentCount={post.comment_count || 0}
                  shareCount={0}
                  onToggleLike={() => toggleReaction(post.id, myReact || "❤️")}
                  onOpenReposts={() => {}}
                />
              </div>
            )
          })}`;

cf = cf.replace(oldMap, newMap);
fs.writeFileSync(cfFile, cf);
console.log('✅ CommunityFeed map replaced with ProfilePostCard');
