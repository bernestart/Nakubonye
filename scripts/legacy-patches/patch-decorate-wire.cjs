const fs = require("fs");
const p = "src/components/ReelComposer.jsx";
let s = fs.readFileSync(p, "utf8");

// 1. Import
const importAnchor = `import ReelTrim from "./ReelTrim"`;
if (!s.includes(importAnchor)) { console.error("ReelTrim import missing"); process.exit(1); }
if (!s.includes("ReelDecorate")) {
  s = s.replace(importAnchor, importAnchor + `\nimport ReelDecorate from "./ReelDecorate"`);
}

// 2. Add stage state
const stateAnchor = `  const [trimming, setTrimming] = useState(false)`;
if (!s.includes(stateAnchor)) { console.error("trimming state missing"); process.exit(1); }
if (!s.includes("stage")) {
  s = s.replace(stateAnchor, stateAnchor + `\n  const [stage, setStage] = useState("capture") // capture | trim | decorate | publish`);
}

// 3. Change ReelTrim flow: onDone should go to decorate, not back to publish
const oldTrimOnDone = `        onDone={(trim) => {
          setTrimStart(trim.trimStart || 0)
          setTrimEnd(trim.trimEnd || null)
          setMirroredState(!!trim.mirrored)
          setAspectRatioState(trim.aspectRatio || "9:16")
          setTextOverlaysState(trim.textOverlays || [])
          setClipsState(trim.clips || [])
          setTrimming(false)
        }}`;
const newTrimOnDone = `        onDone={(trim) => {
          setTrimStart(trim.trimStart || 0)
          setTrimEnd(trim.trimEnd || null)
          setMirroredState(!!trim.mirrored)
          setAspectRatioState(trim.aspectRatio || "9:16")
          setTextOverlaysState(trim.textOverlays || [])
          setClipsState(trim.clips || [])
          setTrimming(false)
          setStage("decorate")
        }}`;
if (!s.includes(oldTrimOnDone)) { console.error("trim onDone block missing"); process.exit(1); }
s = s.replace(oldTrimOnDone, newTrimOnDone);

// 4. Render ReelDecorate when stage is decorate
const shareReturnAnchor = `  if (preview && file) {
    return (`;
if (!s.includes(shareReturnAnchor)) { console.error("share return anchor missing"); process.exit(1); }
if (!s.includes("<ReelDecorate")) {
  s = s.replace(shareReturnAnchor, `  if (stage === "decorate" && clipsState.length > 0) {
    return (
      <ReelDecorate
        clips={clipsState}
        initialOverlays={textOverlaysState}
        onBack={() => setStage("trim")}
        onNext={({ textOverlays }) => {
          setTextOverlaysState(textOverlays || [])
          setStage("publish")
        }}
      />
    )
  }

${shareReturnAnchor}`);
}

// 5. When leaving the composer, reset stage
const onDoneCall = `    setProgress(100); setBusy(false); onDone?.()`;
if (!s.includes(onDoneCall)) { console.error("onDone call missing"); process.exit(1); }
if (!s.includes("setStage(\"capture\")")) {
  s = s.replace(onDoneCall, `    setProgress(100); setBusy(false); setStage("capture"); onDone?.()`);
}

fs.writeFileSync(p, s);
console.log("ReelDecorate wired");
