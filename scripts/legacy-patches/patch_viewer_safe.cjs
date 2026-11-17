const fs = require('fs');
const file = 'src/components/StoryViewer.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import
if (!content.includes('VoiceStatusPlayer')) {
  content = content.replace('import StoryMusicPlayer from "./stories/StoryMusicPlayer"', 'import StoryMusicPlayer from "./stories/StoryMusicPlayer"\nimport VoiceStatusPlayer from "./stories/VoiceStatusPlayer"');
}

// 2. Timer update (Just change the DURATION line)
content = content.replace(
  'const DURATION = story.media_type === "video" ? null : IMAGE_DURATION',
  'const isAudio = story.media_type === "audio/webm"\n    const isVideo = story.media_type === "video"\n    const DURATION = (isVideo || isAudio) ? null : IMAGE_DURATION'
);

// 3. Media block update (Inject audio ternary right at the start of the video check)
const searchMedia = '{story.media_type === "video" ? (';
const replaceMedia = '{story.media_type === "audio/webm" ? (\n          <VoiceStatusPlayer url={story.media_url} backgroundColor={story.background_color} duration={story.duration} onProgress={(p) => { if (!paused) setProgress(p / 100); }} onEnded={advance} />\n        ) : story.media_type === "video" ? (';

if (content.includes(searchMedia) && !content.includes('story.media_type === "audio/webm"')) {
  content = content.replace(searchMedia, replaceMedia);
  console.log('✅ Injected Audio block into StoryViewer media render');
} else if (content.includes('story.media_type === "audio/webm"')) {
  console.log('✅ Audio block already exists in StoryViewer');
} else {
  console.error('❌ Could not find video anchor in StoryViewer');
  process.exit(1);
}

fs.writeFileSync(file, content);
console.log('✅ Successfully patched StoryViewer.jsx!');
