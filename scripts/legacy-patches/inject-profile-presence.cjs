const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Import
if (!code.includes('OnlineDot')) {
  code = "import OnlineDot from '../components/OnlineDot';\n" + code;
}

// 2. Inject the dot on the Avatar (line 616 area)
// We look for the avatar image container and add the dot relative to it.
const avatarTarget = `{(person.display_name || person.username || '?')[0].toUpperCase()}`;
if (code.includes(avatarTarget)) {
  // This is inside the fallback div, so we add the dot outside the image/fallback block
  code = code.replace(
    `</div>`, // This might be too generic, we will use a more specific target
    `</div>` // placeholder
  );
  // Better approach: find the closing of the avatar container
  const avatarRegex = /(className="[^"]*w-24 h-24[^"]*"[^>]*>[\s\S]*?<\/div>)/;
  if (avatarRegex.test(code)) {
    code = code.replace(avatarRegex, (match) => match + `\n                  <OnlineDot userId={userId} myId={myId} variant="avatar" />`);
    console.log("✅ Injected avatar dot (regex)");
  } else {
    console.log("⚠️ Could not find avatar container. Manual injection may be needed.");
  }
}

// 3. Inject "Active now" text next to the name (line 628 area)
const nameTarget = `{person.display_name || person.username}`;
if (code.includes(nameTarget)) {
  code = code.replace(
    nameTarget,
    `<div className="flex flex-col">
                  <span>{person.display_name || person.username}</span>
                  <OnlineDot userId={userId} myId={myId} variant="text" />
                </div>`
  );
  console.log("✅ SUCCESS: Active text injected next to Profile name!");
} else {
  console.log("⚠️ Could not find the exact name string in ProfileView.jsx");
}

fs.writeFileSync(file, code);
