// src/lib/lucide-shim.jsx
// Redirects `lucide-react` imports to Phosphor icons with FB-tier bold weight.
// Vite alias in vite.config.js maps 'lucide-react' → this file.
import {
  Pulse as PhActivity,
  WarningCircle as PhWarningCircle,
  Warning as PhWarning,
  Archive as PhArchive,
  ArrowLeft as PhArrowLeft,
  At as PhAt,
  Prohibit as PhProhibit,
  Money as PhMoney,
  ChartBar as PhChartBar,
  Bell as PhBell,
  BellSlash as PhBellSlash,
  Bookmark as PhBookmark,
  Briefcase as PhBriefcase,
  Cake as PhCake,
  Calendar as PhCalendar,
  Camera as PhCamera,
  Check as PhCheck,
  Checks as PhChecks,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  FilmSlate as PhFilmSlate,
  Clock as PhClock,
  Coins as PhCoins,
  Compass as PhCompass,
  Copy as PhCopy,
  Crown as PhCrown,
  CurrencyDollar as PhCurrencyDollar,
  Download as PhDownload,
  PencilSimple as PhPencilSimple,
  Eraser as PhEraser,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  FileText as PhFileText,
  Funnel as PhFunnel,
  Flag as PhFlag,
  Gift as PhGift,
  Globe as PhGlobe,
  GraduationCap as PhGraduationCap,
  Heart as PhHeart,
  Image as PhImage,
  ImageSquare as PhImageSquare,
  Tray as PhTray,
  Info as PhInfo,
  Key as PhKey,
  Stack as PhStack,
  SquaresFour as PhSquaresFour,
  Lock as PhLock,
  SignOut as PhSignOut,
  Envelope as PhEnvelope,
  MapPin as PhMapPin,
  ChatCircle as PhChatCircle,
  Chat as PhChat,
  Microphone as PhMicrophone,
  MicrophoneSlash as PhMicrophoneSlash,
  Desktop as PhDesktop,
  DotsThree as PhDotsThree,
  DotsThreeVertical as PhDotsThreeVertical,
  Newspaper as PhNewspaper,
  Paperclip as PhPaperclip,
  Pause as PhPause,
  NotePencil as PhNotePencil,
  Pencil as PhPencil,
  Phone as PhPhone,
  PhoneSlash as PhPhoneSlash,
  PushPin as PhPushPin,
  Play as PhPlay,
  Plus as PhPlus,
  ArrowsClockwise as PhArrowsClockwise,
  ArrowCounterClockwise as PhArrowCounterClockwise,
  MagnifyingGlass as PhMagnifyingGlass,
  PaperPlaneTilt as PhPaperPlaneTilt,
  Gear as PhGear,
  ShareNetwork as PhShareNetwork,
  Shield as PhShield,
  ShieldCheck as PhShieldCheck,
  Sliders as PhSliders,
  SlidersHorizontal as PhSlidersHorizontal,
  DeviceMobile as PhDeviceMobile,
  Smiley as PhSmiley,
  Sparkle as PhSparkle,
  Square as PhSquare,
  Star as PhStar,
  Storefront as PhStorefront,
  Tag as PhTag,
  Timer as PhTimer,
  Trash as PhTrash,
  TrendUp as PhTrendUp,
  ArrowUUpLeft as PhArrowUUpLeft,
  User as PhUser,
  UserCheck as PhUserCheck,
  UserCircle as PhUserCircle,
  UserPlus as PhUserPlus,
  UserMinus as PhUserMinus,
  Users as PhUsers,
  VideoCamera as PhVideoCamera,
  VideoCameraSlash as PhVideoCameraSlash,
  SpeakerLow as PhSpeakerLow,
  SpeakerHigh as PhSpeakerHigh,
  Wallet as PhWallet,
  WifiSlash as PhWifiSlash,
  X as PhX,
  Lightning as PhLightning,
  CameraRotate as PhCameraRotate,
  ArrowRight as PhArrowRight,
  Baby as PhBaby,
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
  LinkSimple as Simple,
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
  ShieldSlash as PhShieldSlash,
  ArrowSquareOut as PhArrowSquareOut,
  FlipVertical as PhFlipVertical,
  Megaphone as PhMegaphone,
  MagicWand as PhMagicWand,
  ArrowClockwise as PhArrowClockwise2,
  Scroll as PhScroll,
  Record as PhRecord,
  Hash as PhHash,
  Link as PhLink,
  CloudSun as PhCloudSun,
  Spinner as PhSpinner,
  LinkSimple as PhLinkSimple,
  Question as PhQuestion,
  TextAlignLeft as PhTextAlignLeft,
  TextAlignCenter as PhTextAlignCenter,
  TextAlignRight as PhTextAlignRight,
  PenNib as PhPenNib,
  HighlighterCircle as PhHighlighterCircle
} from '@phosphor-icons/react'

// Wrapper: accepts lucide's `size` / `strokeWidth` / `fill`,
// maps to Phosphor's `size` / `weight`. Default weight = bold (FB-tier chunk).
function shim(Icon) {
  return function LucideCompat({ size, fill, strokeWidth, ...rest }) {
    const isFilled = fill && fill !== 'none' && fill !== 'transparent'
    const weight = isFilled
      ? 'fill'
      : (strokeWidth != null && Number(strokeWidth) <= 1.75 ? 'regular' : 'bold')
    return <Icon size={size ?? 24} weight={weight} {...rest} />
  }
}

export const Activity = shim(PhActivity)
export const AlertCircle = shim(PhWarningCircle)
export const AlertTriangle = shim(PhWarning)
export const Archive = shim(PhArchive)
export const ArrowLeft = shim(PhArrowLeft)
export const AtSign = shim(PhAt)
export const Ban = shim(PhProhibit)
export const Banknote = shim(PhMoney)
export const BarChart3 = shim(PhChartBar)
export const Bell = shim(PhBell)
export const BellOff = shim(PhBellSlash)
export const Bookmark = shim(PhBookmark)
export const Briefcase = shim(PhBriefcase)
export const Cake = shim(PhCake)
export const Calendar = shim(PhCalendar)
export const Camera = shim(PhCamera)
export const Check = shim(PhCheck)
export const CheckCheck = shim(PhChecks)
export const ChevronDown = shim(PhCaretDown)
export const ChevronLeft = shim(PhCaretLeft)
export const ChevronRight = shim(PhCaretRight)
export const Clapperboard = shim(PhFilmSlate)
export const Clock = shim(PhClock)
export const Coins = shim(PhCoins)
export const Compass = shim(PhCompass)
export const Copy = shim(PhCopy)
export const Crown = shim(PhCrown)
export const DollarSign = shim(PhCurrencyDollar)
export const Download = shim(PhDownload)
export const Edit = shim(PhPencilSimple)
export const Edit3 = shim(PhPencilSimple)
export const Eraser = shim(PhEraser)
export const Eye = shim(PhEye)
export const EyeOff = shim(PhEyeSlash)
export const FileText = shim(PhFileText)
export const Filter = shim(PhFunnel)
export const Flag = shim(PhFlag)
export const Gift = shim(PhGift)
export const Globe = shim(PhGlobe)
export const GraduationCap = shim(PhGraduationCap)
export const Heart = shim(PhHeart)
export const Image = shim(PhImage)
export const ImagePlus = shim(PhImageSquare)
export const Inbox = shim(PhTray)
export const Info = shim(PhInfo)
export const Key = shim(PhKey)
export const Layers = shim(PhStack)
export const LayoutGrid = shim(PhSquaresFour)
export const Lock = shim(PhLock)
export const LogOut = shim(PhSignOut)
export const Mail = shim(PhEnvelope)
export const MapPin = shim(PhMapPin)
export const MessageCircle = shim(PhChatCircle)
export const MessageSquare = shim(PhChat)
export const Mic = shim(PhMicrophone)
export const MicOff = shim(PhMicrophoneSlash)
export const Monitor = shim(PhDesktop)
export const MoreHorizontal = shim(PhDotsThree)
export const MoreVertical = shim(PhDotsThreeVertical)
export const Newspaper = shim(PhNewspaper)
export const Paperclip = shim(PhPaperclip)
export const Pause = shim(PhPause)
export const PenSquare = shim(PhNotePencil)
export const Pencil = shim(PhPencil)
export const Phone = shim(PhPhone)
export const PhoneOff = shim(PhPhoneSlash)
export const Pin = shim(PhPushPin)
export const Play = shim(PhPlay)
export const Plus = shim(PhPlus)
export const RefreshCw = shim(PhArrowsClockwise)
export const RotateCcw = shim(PhArrowCounterClockwise)
export const Search = shim(PhMagnifyingGlass)
export const Send = shim(PhPaperPlaneTilt)
export const Settings = shim(PhGear)
export const Share2 = shim(PhShareNetwork)
export const Shield = shim(PhShield)
export const ShieldCheck = shim(PhShieldCheck)
export const Sliders = shim(PhSliders)
export const SlidersHorizontal = shim(PhSlidersHorizontal)
export const Smartphone = shim(PhDeviceMobile)
export const Smile = shim(PhSmiley)
export const Sparkles = shim(PhSparkle)
export const Square = shim(PhSquare)
export const Star = shim(PhStar)
export const Store = shim(PhStorefront)
export const SwitchCamera = shim(PhCameraRotate)
export const Tag = shim(PhTag)
export const Timer = shim(PhTimer)
export const Trash2 = shim(PhTrash)
export const TrendingUp = shim(PhTrendUp)
export const Undo2 = shim(PhArrowUUpLeft)
export const User = shim(PhUser)
export const UserCheck = shim(PhUserCheck)
export const UserCircle = shim(PhUserCircle)
export const UserPlus = shim(PhUserPlus)
export const UserX = shim(PhUserMinus)
export const Users = shim(PhUsers)
export const Video = shim(PhVideoCamera)
export const VideoOff = shim(PhVideoCameraSlash)
export const Volume1 = shim(PhSpeakerLow)
export const Volume2 = shim(PhSpeakerHigh)
export const Wallet = shim(PhWallet)
export const WifiOff = shim(PhWifiSlash)
export const X = shim(PhX)
export const Zap = shim(PhLightning)

export const ArrowRight = shim(PhArrowRight)
export const Baby = shim(PhBaby)
export const BarChart2 = shim(PhChartBar)
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

export const UserMinus = shim(PhUserMinus)
export const ShieldOff = shim(PhShieldSlash)
export const ExternalLink = shim(PhArrowSquareOut)

export const FlipVertical = shim(PhFlipVertical)
export const Megaphone = shim(PhMegaphone)
export const Wand2 = shim(PhMagicWand)
export const RotateCw = shim(PhArrowClockwise2)
export const ScrollText = shim(PhScroll)
export const CircleDot = shim(PhRecord)
export const Hash = shim(PhHash)

export const CheckCircle2 = (props) => <Check {...props} />; // Fallback to Check

export const Award = (props) => <Star {...props} />; // Fallback to Star

export const CloudSun = shim(PhCloudSun)
export const BarChart = shim(PhChartBar)
export const Link = shim(PhLink)
export const HelpCircle = shim(PhQuestion)

// Added for Phase 3 & 4 (Text Alignment & Drawing)
export const AlignLeft = shim(PhTextAlignLeft)
export const AlignCenter = shim(PhTextAlignCenter)
export const AlignRight = shim(PhTextAlignRight)
export const PenTool = shim(PhPenNib)
export const Highlighter = shim(PhHighlighterCircle)
