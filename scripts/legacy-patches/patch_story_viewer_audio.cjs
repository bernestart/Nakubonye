const fs = require('fs');
const file = 'src/components/StoryViewer.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('VoiceStatusPlayer')) {
  content = content.replace(
    'import React',
    'import VoiceStatusPlayer from "./stories/VoiceStatusPlayer"\nimport React'
  );
}

// 2. Find the render logic for media. We look for where it handles video or img.
// We will inject our player before the img/video logic.
const regex = /(\{story\?\.media_type\?\.startsWith\("video\/"\) \? \([\s\S]*?\) : \([\s\S]*?\<img[\s\S]*?\>[\s\S]*?\)\})/;

const replacement = `{story?.media_type === "audio/webm" ? (
              <VoiceStatusPlayer url={story.media_url} backgroundColor={story.background_color} />
            ) : story?.media_type?.startsWith("video/") ? (
              <video src={story.media_url} autoPlay playsInline muted={false} className="w-full h-full object-contain" />
            ) : (
              <img src={story.media_url} alt="" className="w-full h-full object-contain" />
            )}`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
  console.log('✅ Patched StoryViewer.jsx with VoiceStatusPlayer');
} else {
  console.error('❌ Could not find the media render block in StoryViewer.jsx. We will need to manually edit.');
}
