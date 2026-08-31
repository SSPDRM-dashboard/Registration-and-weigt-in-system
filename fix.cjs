const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace header
code = code.replace(/<span className="font-display font-bold tracking-wider uppercase bg-slate-950\/20 px-1\.5 py-0\.5 rounded border border-white\/20 shrink-0( text-white)?" style=\{\{ fontSize: getFontSizePx\(field\.fontSize, '8px'\), color: field\.color \|\| '#ffffff' \}\}>\{p\.event(\|\| activeComp\.name)?\}<\/span>/g,
  `{!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event || activeComp.name}</span>}`
);

// Replace metadata
const metadataRegex = /if \(field\.id === 'metadata'\) \{\s+return \(\s+<div key="metadata" className=\{`px-4 py-1 shrink-0 grid grid-cols-2 gap-2 text-\[10px\] border-t border-line\/30 pt-2\.5 \$\{[\s\S]*?\}<\/div>\s+\);\s+\}/g;

code = code.replace(metadataRegex, match => {
  return `if (field.id === 'metadata') {
    if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') {
      return (
        <div key="metadata" className="px-4 py-1 shrink-0 flex items-center justify-center border-t border-line/30 pt-4 pb-2">
          <span className="font-display font-bold text-xl tracking-widest uppercase text-white px-6 py-2 bg-slate-900/60 rounded-xl border border-white/20 shadow-md">
            {p.event}
          </span>
        </div>
      );
    }
` + match.replace(/if \(field\.id === 'metadata'\) \{\s+return \(/, '    return (') + `
  }`;
});

// Replace qrcode athlete text
code = code.replace(/Scan to digitally verify athlete\./g, "Scan to digitally verify {p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF' ? 'personnel.' : 'athlete.'}");

fs.writeFileSync('src/App.tsx', code);
