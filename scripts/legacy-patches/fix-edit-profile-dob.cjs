const fs = require('fs');
const file = 'src/screens/EditProfile.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Change the input type to text with placeholder
code = code.replace(/<input[\s\S]*?type="date"[\s\S]*?\/>/, 
`<input
                type="text"
                placeholder="DD/MM/YYYY"
                value={dateOfBirth || ''}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-elevated border border-line rounded-2xl px-4 py-3 text-cream text-[15px] focus:outline-none focus:border-purple-500"
              />`);

// 2. Add a date converter in the save function
// Look for: date_of_birth: dateOfBirth || null,
const oldSave = `date_of_birth: dateOfBirth || null,`;
const newSave = `date_of_birth: dateOfBirth ? dateOfBirth.split('/').reverse().join('-') : null, // Converts DD/MM/YYYY to YYYY-MM-DD`;

if (code.includes(oldSave)) {
  code = code.replace(oldSave, newSave);
}

fs.writeFileSync(file, code);
console.log("✅ SUCCESS: EditProfile.jsx DOB is now text and formatted for Neon!");
