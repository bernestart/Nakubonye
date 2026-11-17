const fs = require('fs');
const file = 'src/components/stories/StoryPollSticker.jsx';
let content = fs.readFileSync(file, 'utf8');

// Add supabase import
if (!content.includes('supabase')) {
  content = content.replace(
    'import { tap } from "../../lib/haptic"',
    'import { tap } from "../../lib/haptic"\nimport { supabase } from "../../lib/supabase"'
  );
}

// Update the click handler to save to DB
const oldClick = 'onClick={() => { tap("light"); setVoted(i) }}';
const newClick = `onClick={async () => { 
              tap("light"); 
              setVoted(i); 
              await supabase.from('story_poll_votes').upsert(
                { story_id: poll.story_id || poll.id, user_id: myId, option_index: i },
                { onConflict: 'story_id, user_id' }
              );
            }}`;

if (content.includes(oldClick)) {
  content = content.replace(oldClick, newClick);
  fs.writeFileSync(file, content);
  console.log('✅ Successfully wired StoryPollSticker to Supabase!');
} else {
  console.log('❌ Could not find click handler in StoryPollSticker.');
}
