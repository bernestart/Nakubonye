const fs=require('fs');
const api=fs.readFileSync('src/lib/api.js','utf8');
if(!/export\s+(const|async function|function)\s+uploadMedia\b/.test(api)&&!/export\s*\{[^}]*\buploadMedia\b/.test(api)){console.log('ABORTED: uploadMedia is not exported from src/lib/api.js');process.exit(1);}
const files=['src/components/CommunityFeed.jsx','src/components/PostComposer.jsx'];
const out={};const notes=[];
for(const f of files){
  let s=fs.readFileSync(f,'utf8');
  if(/import[^;\n]*\buploadMedia\b[^;\n]*from/.test(s)){notes.push(f+': already imported');continue;}
  if(/\{[^}]*\buploadMedia\b[^}]*\}\s*(\)|=)/.test(s)){notes.push(f+': uploadMedia looks like a prop, skipped');continue;}
  out[f]="import { uploadMedia } from '../lib/api'\n"+s;
  notes.push(f+': import added');
}
for(const [f,c] of Object.entries(out))fs.writeFileSync(f,c);
console.log('APPLIED:\n- '+notes.join('\n- '));
