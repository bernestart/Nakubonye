const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Inject the tracking logic right after the state variables
const stateAnchor = 'const [commentsFor, setCommentsFor] = useState(null)';
const trackingLogic = `const [commentsFor, setCommentsFor] = useState(null)
  
  // --- FEED ALGORITHM TRACKING ---
  const observedPosts = useRef(new Set());
  const observerRef = useRef(null);

  useEffect(() => {
    if (!myId) return;
    
    // Setup IntersectionObserver for impressions
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const postId = entry.target.getAttribute('data-post-id');
          if (postId && !observedPosts.current.has(postId)) {
            observedPosts.current.add(postId);
            try {
              // Upsert prevents duplicate errors if the user scrolls up and down
              await supabase.from('feed_impressions').upsert(
                { post_id: postId, user_id: myId }, 
                { onConflict: 'post_id, user_id', ignoreDuplicates: true }
              );
            } catch (e) { console.warn("Impression track failed", e); }
          }
        }
      });
    }, { threshold: 0.5 }); // Trigger when 50% of the post is visible

    return () => observerRef.current?.disconnect();
  }, [myId]);

  const observePost = (el) => {
    if (el) observerRef.current?.observe(el);
  };

  const trackClick = async (postId) => {
    if (!myId || !postId) return;
    try {
      await supabase.from('feed_clicks').upsert(
        { post_id: postId, user_id: myId }, 
        { onConflict: 'post_id, user_id', ignoreDuplicates: true }
      );
    } catch (e) { console.warn("Click track failed", e); }
  };
  // -------------------------------`;

if (!content.includes('observePost')) {
  content = content.replace(stateAnchor, trackingLogic);
}

// 2. Add the ref and data-post-id to the article tags (Reels & Normal Posts)
// We replace the existing <article data-post-key=... with our new attributes
content = content.replace(/<article data-post-key=\{/g, '<article ref={observePost} data-post-id={p.id} data-post-key={');
// Fallback in case some use string concatenation instead of brackets
content = content.replace(/<article data-post-key="/g, '<article ref={observePost} data-post-id={p.id} data-post-key="');

// 3. Add trackClick to the comment button
const oldClick = 'onClick={() => { tap("light"); setCommentsFor({ id: p.id, source: p._source }) }}';
const newClick = 'onClick={() => { tap("light"); trackClick(p.id); setCommentsFor({ id: p.id, source: p._source }) }}';

if (content.includes(oldClick)) {
  content = content.replace(oldClick, newClick);
}

fs.writeFileSync(file, content);
console.log('✅ Successfully injected IntersectionObserver and Click tracking into Feed.jsx!');
