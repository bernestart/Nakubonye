const fs = require('fs');
const file = 'src/components/StoryViewer.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove VoiceStatusPlayer import if it exists
content = content.replace('import VoiceStatusPlayer from "./stories/VoiceStatusPlayer"\n', '');

// 2. Remove the Voice ternary block
const voiceBlockRegex = /\{story\.media_type === "audio\/webm" \? \([\s\S]*?\) : story\.media_type === "video" \? \(/;
content = content.replace(voiceBlockRegex, '{story.media_type === "video" ? (');

// 3. Ensure the timer logic is clean
content = content.replace(
  'const isAudio = story.media_type === "audio/webm"\n    const isVideo = story.media_type === "video"\n    const DURATION = (isVideo || isAudio) ? null : IMAGE_DURATION',
  'const DURATION = story.media_type === "video" ? null : IMAGE_DURATION'
);

fs.writeFileSync(file, content);
console.log('✅ Successfully cleaned StoryViewer.jsx (Voice removed, Video/Image ready)');
