const fs = require('fs');

function fix(file, badLine, searchLine, replaceLine) {
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(badLine)) src = src.replace(badLine, ''); // Remove the duplicate line we added
  if (src.includes(searchLine)) src = src.replace(searchLine, replaceLine); // Add missing icons to the original line
  fs.writeFileSync(file, src);
  console.log('✅ Fixed imports in ' + file);
}

fix(
  'src/components/StoryComposer.jsx',
  'import { Mic, Square, Trash2, Send } from "lucide-react";',
  'import { X, ImagePlus, RefreshCw, Send, Pencil } from "lucide-react";',
  'import { X, ImagePlus, RefreshCw, Send, Pencil, Mic, Trash2 } from "lucide-react";'
);

fix(
  'src/components/PostCommentsSheet.jsx',
  'import { Send, Mic, Square, Trash2 } from "lucide-react";',
  'import { X, Send, Trash2, Heart, Pencil, CornerDownRight, Pin } from "lucide-react";',
  'import { X, Send, Trash2, Heart, Pencil, CornerDownRight, Pin, Mic } from "lucide-react";'
);
