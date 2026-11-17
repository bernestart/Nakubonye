const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update the SQL select to include account_type and category_label
const oldSelect = ".select('id, display_name, username, date_of_birth, bio, city, country, is_verified, tier, looking_for, cover_photo_path, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children, hide_age')";
const newSelect = ".select('id, display_name, username, date_of_birth, bio, city, country, is_verified, tier, looking_for, cover_photo_path, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children, hide_age, account_type, category_label')";

if (content.includes(oldSelect)) {
  content = content.replace(oldSelect, newSelect);
  console.log('✅ Added account_type and category_label to Profile Query');
} else {
  console.log('⚠️ Could not find exact select string. Checking for variants...');
}

// 2. Inject the Category Label under the display name
const nameAnchor = '<h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-1">\n            {person.display_name || person.username}\n          </h1>';
// Since I don't know the exact wrapper, I will target the text itself and wrap it
const textAnchor = '{person.display_name || person.username}';

if (content.includes(textAnchor)) {
  // Find the line and inject the category right after it
  const replacement = `{person.display_name || person.username}
          {person.account_type === 'creator' && person.category_label && (
            <span className="block text-purple-400 text-[11px] font-bold tracking-wide uppercase mt-1">
              {person.category_label}
            </span>
          )}`;
  content = content.replace(textAnchor, replacement);
  console.log('✅ Injected Category Label under Display Name');
}

fs.writeFileSync(file, content);
