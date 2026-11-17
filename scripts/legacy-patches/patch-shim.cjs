const fs = require('fs');
const p = 'src/lib/lucide-shim.jsx';
let s = fs.readFileSync(p, 'utf8');

// --- 1. Add missing Phosphor imports before the closing of the import block ---
const newImports = `  ArrowRight as PhArrowRight,
  Baby as PhBaby,
  ChartBar as PhChartBar2,
  BookOpen as PhBookOpen,
  CaretUp as PhCaretUp,
  Cigarette as PhCigarette,
  Circle as PhCircle,
  ArrowElbowDownRight as PhArrowElbowDownRight,
  Crop as PhCrop,
  Barbell as PhBarbell,
  FlipHorizontal as PhFlipHorizontal,
  ArrowBendUpRight as PhArrowBendUpRight,
  Gauge as PhGauge,
  Hammer as PhHammer,
  House as PhHouse,
  Translate as PhTranslate,
  LinkSimple as PhLinkSimple,
  CircleNotch as PhCircleNotch,
  MusicNotes as PhMusicNotes,
  PauseCircle as PhPauseCircle,
  PawPrint as PhPawPrint,
  PushPinSlash as PhPushPinSlash,
  PlayCircle as PhPlayCircle,
  ArrowClockwise as PhArrowClockwise,
  Repeat as PhRepeat,
  ArrowBendUpLeft as PhArrowBendUpLeft,
  Ruler as PhRuler,
  BowlFood as PhBowlFood,
  Scissors as PhScissors,
  Shapes as PhShapes,
  Shuffle as PhShuffle,
  Target as PhTarget,
  TextT as PhTextT,
  Upload as PhUpload,
  SpeakerX as PhSpeakerX,
  WifiHigh as PhWifiHigh,
  Wine as PhWine,
`;

const closeImport = `} from '@phosphor-icons/react'`;
const impIdx = s.indexOf(closeImport);
if (impIdx === -1) { console.error('❌ phosphor import close not found'); process.exit(1); }
s = s.slice(0, impIdx) + newImports + s.slice(impIdx);
console.log('✅ new Phosphor imports added');

// --- 2. Append missing shim exports at the end ---
const newExports = `
export const ArrowRight = shim(PhArrowRight)
export const Baby = shim(PhBaby)
export const BarChart2 = shim(PhChartBar2)
export const BookOpen = shim(PhBookOpen)
export const ChevronUp = shim(PhCaretUp)
export const Cigarette = shim(PhCigarette)
export const Circle = shim(PhCircle)
export const CornerDownRight = shim(PhArrowElbowDownRight)
export const Crop = shim(PhCrop)
export const Dumbbell = shim(PhBarbell)
export const FlipHorizontal = shim(PhFlipHorizontal)
export const Forward = shim(PhArrowBendUpRight)
export const Gauge = shim(PhGauge)
export const Hammer = shim(PhHammer)
export const Home = shim(PhHouse)
export const Languages = shim(PhTranslate)
export const Link2 = shim(PhLinkSimple)
export const Loader2 = shim(PhCircleNotch)
export const Music = shim(PhMusicNotes)
export const PauseCircle = shim(PhPauseCircle)
export const PawPrint = shim(PhPawPrint)
export const PinOff = shim(PhPushPinSlash)
export const PlayCircle = shim(PhPlayCircle)
export const Redo2 = shim(PhArrowClockwise)
export const Repeat2 = shim(PhRepeat)
export const Reply = shim(PhArrowBendUpLeft)
export const Ruler = shim(PhRuler)
export const Salad = shim(PhBowlFood)
export const Scissors = shim(PhScissors)
export const Shapes = shim(PhShapes)
export const Shuffle = shim(PhShuffle)
export const Target = shim(PhTarget)
export const Type = shim(PhTextT)
export const Upload = shim(PhUpload)
export const VolumeX = shim(PhSpeakerX)
export const Wifi = shim(PhWifiHigh)
export const Wine = shim(PhWine)
`;

s = s.trimEnd() + '\n' + newExports;
console.log('✅ new shim exports added');

fs.writeFileSync(p, s);
console.log('✅ lucide-shim.jsx updated');
