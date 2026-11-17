const fs = require('fs');

const patches = [
  {
    file: 'src/screens/Chat.jsx',
    stopFn: 'stopRecording(false)',
    sendFn: 'stopRecording(true)',
    waveVar: 'voiceRecorder.waveform',
    timer: '{Math.floor((voiceRecorder?.seconds || voiceRecorder?.duration || 0) / 60)}:{(Math.floor((voiceRecorder?.duration || voiceRecorder?.seconds || 0) % 60)).toString().padStart(2, \'0\')}'
  },
  {
    file: 'src/screens/GroupChat.jsx',
    stopFn: 'cancelVoice',
    sendFn: 'sendVoice',
    waveVar: 'voice.waveform',
    timer: '{Math.floor((voice.duration || 0) / 60)}:{(Math.floor((voice.duration || 0) % 60)).toString().padStart(2, \'0\')}'
  },
  {
    file: 'src/components/CommunityChat.jsx',
    stopFn: 'cancelVoice',
    sendFn: 'sendVoice',
    waveVar: 'voice.waveform',
    timer: '{Math.floor((voice.seconds || 0) / 60)}:{(Math.floor((voice.seconds || 0) % 60)).toString().padStart(2, \'0\')}'
  }
];

patches.forEach(p => {
  if (!fs.existsSync(p.file)) return;
  let f = fs.readFileSync(p.file, 'utf8');

  const metaJSX = `{/* Meta-Style Recording Bar */}
    <div className="flex-1 flex items-center gap-2 min-w-0 px-1">
      {/* Trash - Fixed Left */}
      <button onClick={() => ${p.stopFn}} className="shrink-0 text-red-500 hover:text-red-400 p-2">
        <Trash2 size={22} strokeWidth={2.2} />
      </button>

      {/* Center Pill */}
      <div className="flex-1 min-w-0 flex items-center bg-[#1C1C1E] border border-white/10 rounded-full px-4 h-11">
        {/* Timer */}
        <span className="text-white text-[13px] font-mono font-semibold shrink-0 mr-3">
          ${p.timer}
        </span>

        {/* Waveform - Flexible but strictly clipped */}
        <div className="flex-1 min-w-0 h-6 flex items-center justify-center gap-[2px] overflow-hidden">
          ${p.waveVar}.slice(-30).map((level, i) => (
            <div key={i} className="w-[3px] bg-white/60 rounded-full transition-all duration-75" style={{ height: \`\${Math.max(10, level * 100)}%\` }} />
          ))}
        </div>

        {/* ViewOnce "1" - Fixed Right Inside Pill */}
        <button onClick={() => { setViewOnce(v => !v); tap("light"); }} className="shrink-0 w-6 h-6 rounded-full grid place-items-center ml-3" style={{ background: viewOnce ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" : "transparent", border: viewOnce ? "none" : "1px solid #888" }}>
          <span className="font-black text-[10px]" style={{ color: viewOnce ? "#fff" : "#888" }}>1</span>
        </button>
      </div>

      {/* Send - Fixed Right */}
      <button onClick={() => ${p.sendFn}} className="shrink-0 text-purple-500 hover:text-purple-400 p-2">
        <Send size={22} strokeWidth={2.5} />
      </button>
    </div>`;

  // Regex to find the old recording bar and replace it completely
  const regex = /<div className="flex-1 min-w-0 flex items-center gap-2 bg-\[#1C1C1E\][\s\S]*?<Send size=\{20\} strokeWidth=\{2\.5\} \/>\s*<\/button>\s*<\/div>/g;
  
  if (regex.test(f)) {
    f = f.replace(regex, metaJSX);
    fs.writeFileSync(p.file, f);
    console.log('✅ ' + p.file + ': Replaced with strict Meta UI');
  } else {
    console.log('⚠️ ' + p.file + ': Pattern not found. Previous patch may have altered the string.');
  }
});
