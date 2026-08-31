const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// We have 3 occurrences remaining.
// They look like: <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event || activeComp.name}</span>
// and <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event || activeComp.name}</span>

const regex = /<span className="font-display font-bold tracking-wider uppercase bg-slate-950\/20 px-1\.5 py-0\.5 rounded border border-white\/20 shrink-0(?: text-white)?" style=\{\{ fontSize: getFontSizePx\(field\.fontSize, '8px'\), color: field\.color \|\| '#ffffff' \}\}>\{p\.event \|\| activeComp\.name\}<\/span>/g;

code = code.replace(regex, `{!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event || activeComp.name}</span>}`);

fs.writeFileSync('src/App.tsx', code);
