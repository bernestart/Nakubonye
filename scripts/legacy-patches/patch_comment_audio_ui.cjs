const fs = require('fs');
const file = 'src/components/PostCommentsSheet.jsx';

if (!fs.existsSync(file)) {
  console.error('❌ File not found: ' + file);
  process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

// 1. Add Play/Pause icons to the import (merge safely)
if (content.includes('from "lucide-react"')) {
  content = content.replace(/import \{([^}]+)\} from "lucide-react"/, (match, p1) => {
    const icons = new Set(p1.split(',').map(s => s.trim()));
    icons.add('Play');
    icons.add('Pause');
    return `import { ${Array.from(icons).join(', ')} } from "lucide-react"`;
  });
} else {
  content = `import { Play, Pause } from "lucide-react";\n` + content;
}

// 2. Inject the AudioPlayer component before the main export
const audioPlayerComponent = `
function AudioBubble({ url }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-3 bg-white/[0.06] border border-white/10 rounded-full px-4 py-2 mt-1 w-fit min-w-[200px]">
      <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-purple-500 grid place-items-center shrink-0">
        {playing ? <Pause size={14} className="text-white" fill="white" /> : <Play size={14} className="text-white" fill="white" />}
      </button>
      <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-purple-400 w-1/3" /> {/* Static waveform for now */}
      </div>
      <span className="text-[11px] text-muted font-mono">0:00</span>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}

`;

// Insert AudioBubble before the default export
content = content.replace(/(export default function PostCommentsSheet)/, audioPlayerComponent + '$1');

// 3. Modify the renderComment function to conditionally show the AudioBubble
// We look for the block where it renders the comment text/content.
// Since we don't know the exact variable name, we search for the most common pattern: `c.content` or `comment.content`
const renderContentRegex = /(<div[^>]*>\s*)(\{c\.content\}|\{comment\.content\})(\s*<\/div>)/;

if (renderContentRegex.test(content)) {
  content = content.replace(renderContentRegex, (match, p1, p2, p3) => {
    // Keep the text rendering but add the audio player below it
    return `${p1}
      {p2}
      {(c.media_type?.startsWith('audio/') || c.media_url?.endsWith('.webm')) && (
        <AudioBubble url={c.media_url} />
      )}
    ${p3}`;
  });
  console.log('✅ Injected AudioBubble into renderComment');
} else {
  console.error('❌ Could not find the comment content render block. We need to manually add the <AudioBubble> where content is rendered.');
  // Fallback: just add the component and ask user to place it
}

fs.writeFileSync(file, content);
console.log('✅ Patched ' + file);
