const fs = require('fs');
const file = 'src/components/ProfileMenuSheet.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update the component signature to accept accountType and a reload function
content = content.replace(
  'export default function ProfileMenuSheet({ open, onClose, isMe, userId, person, onReport, onBlock }) {',
  'export default function ProfileMenuSheet({ open, onClose, isMe, userId, person, onReport, onBlock, accountType, onToggleCreatorMode }) {'
);

// 2. Add the Row inside the `isMe` block
const boostAnchor = '<Row icon={Megaphone}    label="Boost a post"                onClick={() => go("/boost")} />';
const creatorRow = `<Row icon={Megaphone}    label="Boost a post"                onClick={() => go("/boost")} />
              <Row 
                icon={Sparkles} 
                label={accountType === 'creator' ? "Turn off Creator Mode" : "Turn on Creator Mode"} 
                onClick={() => { onClose(); onToggleCreatorMode?.(); }} 
              />`;

if (content.includes(boostAnchor) && !content.includes('Turn on Creator Mode')) {
  content = content.replace(boostAnchor, creatorRow);
  fs.writeFileSync(file, content);
  console.log('✅ Added Creator Mode Toggle to ProfileMenuSheet');
} else {
  console.log('⚠️ Anchor missing or toggle already exists.');
}
