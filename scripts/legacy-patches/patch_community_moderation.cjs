const fs = require('fs');
const file = 'src/components/CommunityFeed.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Trash2 icon import (merge into existing lucide import)
if (content.includes('lucide-react')) {
  content = content.replace(/import \{([^}]+)\} from "lucide-react"/, (match, p1) => {
    const icons = new Set(p1.split(',').map(s => s.trim()));
    icons.add('Trash2');
    return `import { ${Array.from(icons).join(', ')} } from "lucide-react"`;
  });
}

// 2. Add state for the action sheet
const stateAnchor = 'const [myRole, setMyRole] = useState(null)';
if (!content.includes('const [actionPost, setActionPost]')) {
  content = content.replace(
    stateAnchor,
    `${stateAnchor}\n  const [actionPost, setActionPost] = useState(null)`
  );
}

// 3. Replace the deletePost function to allow Admins/Mods
const oldDeleteFn = `async function deletePost(postId) {
    if (!confirm('Delete this post?')) return
    tap('light')
    const { error: err } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', session.user.id)
    if (err) { setError(err.message); return }
  }`;

const newDeleteFn = `async function deletePost(postId) {
    if (!confirm('Delete this post?')) return
    tap('light')
    
    // Build query
    let query = supabase.from('community_posts').delete().eq('id', postId)
    
    // If the user is NOT an admin/mod, restrict the delete to their own post
    const isModerator = ['owner', 'admin', 'moderator'].includes(myRole)
    if (!isModerator) {
      query = query.eq('author_id', session.user.id)
    }

    const { error: err } = await query
    if (err) { setError(err.message); return }
    
    // Remove from UI
    setPosts(prev => prev.filter(p => p.id !== postId))
  }`;

if (content.includes('async function deletePost')) {
  // Use regex to safely replace the whole function block in case whitespace differs
  content = content.replace(/async function deletePost\([\s\S]*?\n  \}/, newDeleteFn);
} else {
  console.error('❌ Could not find deletePost function.');
}

// 4. Wire up the onOpenMenu prop
const oldMenu = 'onOpenMenu={(p) => { /* open actions */ }}';
const newMenu = 'onOpenMenu={(p) => { tap("light"); setActionPost(post); }}';
if (content.includes(oldMenu)) {
  content = content.replace(oldMenu, newMenu);
}

// 5. Inject the Moderation Bottom Sheet before the final return closing tag
const returnAnchor = 'return (\n    <div className="flex flex-col gap-4">';
const modalUI = `return (
    <div className="flex flex-col gap-4">
      {/* ADMIN MODERATION BOTTOM SHEET */}
      {actionPost && (
        <div className="fixed inset-0 z-[150] flex items-end bg-black/60" onClick={() => setActionPost(null)}>
          <div className="w-full bg-[#0B0B14] rounded-t-3xl border-t border-white/10 p-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            
            {/* Show Delete if Admin OR if it's their own post */}
            {(['owner', 'admin', 'moderator'].includes(myRole) || actionPost.author_id === session.user.id) && (
               <button 
                 onClick={() => { setActionPost(null); deletePost(actionPost.id); }} 
                 className="w-full text-left p-4 rounded-xl text-red-400 font-bold hover:bg-white/5 flex items-center gap-3 active:bg-white/10"
               >
                 <Trash2 size={20} /> Delete Post
               </button>
            )}
            
            <button onClick={() => setActionPost(null)} className="w-full text-center p-4 text-muted font-bold mt-2 active:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}`;

if (!content.includes('ADMIN MODERATION BOTTOM SHEET')) {
  content = content.replace(returnAnchor, modalUI);
}

fs.writeFileSync(file, content);
console.log('✅ Successfully injected Community Moderation logic and UI!');
