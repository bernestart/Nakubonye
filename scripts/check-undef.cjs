const fs=require('fs'),path=require('path');
const CHECKS=[
 ['supabase',/(?<![\w$.'"\/-])supabase(?![\w$'"-])/],
 ['API_BASE_URL',/(?<![\w$.'"\/-])API_BASE_URL(?![\w$'"-])/],
 ['publicPhotoUrl',/\bpublicPhotoUrl\s*\(/],['friendlyError',/\bfriendlyError\s*\(/],
 ['tap',/(?<![\w$.])tap\s*\(/],['uploadMedia',/\buploadMedia\s*\(/],
 ['useAuth',/\buseAuth\s*\(/],['useNavigate',/\buseNavigate\s*\(/],['useParams',/\buseParams\s*\(/],
 ['useState',/\buseState\s*[(<]/],['useEffect',/\buseEffect\s*\(/],['useCallback',/\buseCallback\s*\(/],
 ['useRef',/\buseRef\s*\(/],['useMemo',/\buseMemo\s*\(/],
 ['Link',/<Link[\s>]/],['Navigate',/<Navigate[\s>]/],
];
function walk(d,o){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p,o);else if(/\.(jsx?|js)$/.test(f)&&!/\.bak/.test(f))o.push(p);}return o;}
const IMP=/^import\s+[^'"]*?from\s*['"][^'"]+['"]/gm;
let bad=0;
for(const f of walk('src',[])){
  const src=fs.readFileSync(f,'utf8');
  const imports=(src.match(IMP)||[]).join('\n');
  const body=src.replace(IMP,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|\s)\/\/.*$/gm,'$1');
  for(const [id,re] of CHECKS){
    if(!re.test(body))continue;
    const imported=new RegExp('import\\s+(?:[\\w$]+\\s*,\\s*)?(?:\\{[^}]*\\b'+id+'\\b[^}]*\\}|\\*\\s+as\\s+'+id+'\\b|'+id+'\\b)').test(imports) ||
                    new RegExp('(?:\\{[^}]*\\b'+id+'\\b[^}]*\\}|\\*\\s+as\\s+'+id+'\\b)\\s*=\\s*await\\s+import\\s*\\(').test(src);
    const local=new RegExp('(?:const|let|var|function|class)\\s+'+id+'\\b').test(src);
    if(!imported&&!local){console.log('MISSING '+id+' in '+f);bad++;}
  }
}
console.log(bad?('FOUND '+bad+' undefined-identifier problem(s)'):'check-undef OK');
process.exit(bad?1:0);
