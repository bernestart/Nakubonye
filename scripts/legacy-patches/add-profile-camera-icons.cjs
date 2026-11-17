const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Ensure Camera icon is imported
if (!code.includes('Camera')) {
  code = code.replace(/import \{([^}]+)\} from 'lucide-react'/, "import { $1, Camera } from 'lucide-react'");
}

// We will insert the camera icon right before the closing of the cover photo div and the avatar div.
// Since the exact JSX is complex, we will look for the image tags and wrap them.

// Add camera to Profile Picture (Avatar) - Look for the avatar img tag
const avatarImgRegex = /(<img[^>]*className="w-full h-full object-cover"[^>]*\/>)/;
if (avatarImgRegex.test(code)) {
  code = code.replace(avatarImgRegex, `$1
                  {isMe && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Camera size={24} className="text-white" />
                    </div>
                  )}`);
  console.log("✅ Added camera overlay to Profile Picture");
}

fs.writeFileSync(file, code);
