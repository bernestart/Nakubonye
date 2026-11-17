#!/usr/bin/env node
const fs = require('fs');

let ok = true;
function preflightCheck(file, from, label) {
  const src = fs.readFileSync(file, 'utf8');
  const c = src.split(from).length - 1;
  if (c === 0) { console.error(`\u274c MISSING in ${file}: ${label}`); ok = false; }
  else if (c > 1) { console.error(`\u274c NOT UNIQUE (${c}x) in ${file}: ${label}`); ok = false; }
  else { console.log(`\u2705 ok: ${label}`); }
}

const PI = 'src/components/PostImages.jsx';
preflightCheck(PI, 'export default function PostImages({ paths = [], bucket = "community-media", onDoubleTap, onPostOpen }) {', 'PI props');
preflightCheck(PI, '          src={urls[0]}\n          alt=""', 'PI 1-img alt');

const piSrc = fs.readFileSync(PI, 'utf8');
const gridAltCount = (piSrc.match(/<img src=\{u\} alt="" className="w-full h-full object-cover" loading="lazy" \/>/g) || []).length;
if (gridAltCount === 2) console.log('\u2705 ok: PI grid alt (2 matches)');
else { console.error(`\u274c PI grid alt (expected 2, found ${gridAltCount})`); ok = false; }

preflightCheck(PI, '<img src={urls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />', 'PI 3-img alt 0');
preflightCheck(PI, '<img src={urls[1]} alt="" className="w-full h-full object-cover" loading="lazy" />', 'PI 3-img alt 1');
preflightCheck(PI, '<img src={urls[2]} alt="" className="w-full h-full object-cover" loading="lazy" />', 'PI 3-img alt 2');

const PPC = 'src/components/ProfilePostCard.jsx';
preflightCheck(PPC, 'import ResharedPost from "./ResharedPost"', 'PPC import PostImages');
preflightCheck(PPC, '      {/* Image */}\n      {imageUrl && (\n        <img\n          src={imageUrl}\n          alt=""\n          className="w-full max-h-[500px] object-cover"\n          onClick={() => { tap("light"); nav("/post/personal/" + post.id) }}\n        />\n      )}', 'PPC PostImages');
preflightCheck(PPC, '      {/* Content */}\n      {post.content && (\n        <p className="px-4 pb-2 text-cream text-[14.5px] leading-snug whitespace-pre-wrap">{post.content}</p>\n      )}', 'PPC bg style');

const FD = 'src/screens/Feed.jsx';
preflightCheck(FD, '                  return (\n                    <PostImages\n                      paths={paths}\n                      bucket="community-media"\n                      onDoubleTap={() => toggleLike(p.id, p._source)}\n                      onPostOpen={() => { tap("light"); nav("/post/" + p._source + "/" + p.id) }}\n                    />\n                  )', 'Feed alts');
preflightCheck(FD, '                {p.content && (\n                  <ExpandableText text={p.content} className="px-3 pb-3 text-cream text-[14px] leading-[1.5] whitespace-pre-wrap" />\n                )}', 'Feed bg style');

if (!ok) { console.error('\n\u274c Preflight failed. Files untouched.'); process.exit(1); }

console.log('\n--- applying ---');
let piSrcNew = fs.readFileSync(PI, 'utf8');

piSrcNew = piSrcNew.replace(
  'export default function PostImages({ paths = [], bucket = "community-media", onDoubleTap, onPostOpen }) {',
  'export default function PostImages({ paths = [], bucket = "community-media", onDoubleTap, onPostOpen, alts = [] }) {'
);
piSrcNew = piSrcNew.replace(
  '          src={urls[0]}\n          alt=""',
  '          src={urls[0]}\n          alt={alts[0] || ""}'
);
piSrcNew = piSrcNew.replace(
  /<img src=\{u\} alt="" className="w-full h-full object-cover" loading="lazy" \/>/g,
  '<img src={u} alt={alts[i] || ""} className="w-full h-full object-cover" loading="lazy" />'
);
piSrcNew = piSrcNew.replace(
  '<img src={urls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />',
  '<img src={urls[0]} alt={alts[0] || ""} className="w-full h-full object-cover" loading="lazy" />'
);
piSrcNew = piSrcNew.replace(
  '<img src={urls[1]} alt="" className="w-full h-full object-cover" loading="lazy" />',
  '<img src={urls[1]} alt={alts[1] || ""} className="w-full h-full object-cover" loading="lazy" />'
);
piSrcNew = piSrcNew.replace(
  '<img src={urls[2]} alt="" className="w-full h-full object-cover" loading="lazy" />',
  '<img src={urls[2]} alt={alts[2] || ""} className="w-full h-full object-cover" loading="lazy" />'
);
fs.writeFileSync(PI, piSrcNew);
console.log('\u2705 PI applied');

let ppcSrc = fs.readFileSync(PPC, 'utf8');
ppcSrc = ppcSrc.replace(
  'import ResharedPost from "./ResharedPost"',
  'import ResharedPost from "./ResharedPost"\nimport PostImages from "./PostImages"'
);
ppcSrc = ppcSrc.replace(
  '      {/* Image */}\n      {imageUrl && (\n        <img\n          src={imageUrl}\n          alt=""\n          className="w-full max-h-[500px] object-cover"\n          onClick={() => { tap("light"); nav("/post/personal/" + post.id) }}\n        />\n      )}',
  `      {/* Images */}
      {(() => {
        const paths = Array.isArray(post.image_paths) && post.image_paths.length > 0
          ? post.image_paths
          : (post.image_path ? [post.image_path] : [])
        if (paths.length === 0) return null
        return (
          <PostImages
            paths={paths}
            alts={post.image_alts || []}
            bucket="community-media"
            onPostOpen={() => { tap("light"); nav("/post/" + (post._source || "personal") + "/" + post.id) }}
            onDoubleTap={() => onToggleLike?.()}
          />
        )
      })()}`
);
ppcSrc = ppcSrc.replace(
  '      {/* Content */}\n      {post.content && (\n        <p className="px-4 pb-2 text-cream text-[14.5px] leading-snug whitespace-pre-wrap">{post.content}</p>\n      )}',
  `      {/* Content */}
      {post.content && (
        <div
          className={"mx-3 mb-3 rounded-xl " + (post.background_style ? "p-4 min-h-[120px] flex items-center justify-center" : "")}
          style={{ background: post.background_style || "transparent" }}
        >
          <p className={"text-cream leading-snug whitespace-pre-wrap w-full text-center " + (post.background_style ? "text-[20px] font-bold" : "text-[14.5px]")}>
            {post.content}
          </p>
        </div>
      )}`
);
fs.writeFileSync(PPC, ppcSrc);
console.log('\u2705 PPC applied');

let fdSrc = fs.readFileSync(FD, 'utf8');
fdSrc = fdSrc.replace(
  '                  return (\n                    <PostImages\n                      paths={paths}\n                      bucket="community-media"\n                      onDoubleTap={() => toggleLike(p.id, p._source)}\n                      onPostOpen={() => { tap("light"); nav("/post/" + p._source + "/" + p.id) }}\n                    />\n                  )',
  '                  return (\n                    <PostImages\n                      paths={paths}\n                      alts={p.image_alts || []}\n                      bucket="community-media"\n                      onDoubleTap={() => toggleLike(p.id, p._source)}\n                      onPostOpen={() => { tap("light"); nav("/post/" + p._source + "/" + p.id) }}\n                    />\n                  )'
);
fdSrc = fdSrc.replace(
  '                {p.content && (\n                  <ExpandableText text={p.content} className="px-3 pb-3 text-cream text-[14px] leading-[1.5] whitespace-pre-wrap" />\n                )}',
  `                {p.content && (
                  <div
                    className={"mx-3 mb-3 rounded-xl " + (p.background_style ? "p-4 min-h-[120px] flex items-center justify-center" : "")}
                    style={{ background: p.background_style || "transparent" }}
                  >
                    <ExpandableText
                      text={p.content}
                      className={"text-cream leading-[1.5] whitespace-pre-wrap w-full text-center " + (p.background_style ? "text-[20px] font-bold" : "text-[14px]")}
                    />
                  </div>
                )}`
);
fs.writeFileSync(FD, fdSrc);
console.log('\u2705 FD applied');

console.log('\n\u2705 Done. Patch complete.');
