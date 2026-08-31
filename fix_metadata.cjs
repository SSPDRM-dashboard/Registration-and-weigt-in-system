const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The replacement logic:
const blocks = code.split(/(if \(field\.id === 'metadata'\) \{)/);

let newCode = blocks[0];
for (let i = 1; i < blocks.length; i += 2) {
  const matchStart = blocks[i];
  let rest = blocks[i + 1];
  
  // Find the end of this if block by matching the closing brace of the if statement
  const m = rest.match(/;\s*\n\s*\}/);
  let endIndex = -1;
  if (m) {
    endIndex = m.index + m[0].length;
  }

  const blockContent = rest.substring(0, endIndex);
  const remaining = rest.substring(endIndex);

  // We rewrite the blockContent
  const newBlock = `
    if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') {
      return (
        <div key="metadata" className="px-4 py-1 shrink-0 flex items-center justify-center border-t border-line/30 pt-4 pb-2">
          <span className="font-display font-bold text-xl tracking-widest uppercase text-white px-6 py-2 bg-slate-900/60 rounded-xl border border-white/20 shadow-md">
            {p.event}
          </span>
        </div>
      );
    }
    return (` + blockContent.substring(blockContent.indexOf('return (') + 8);

  newCode += matchStart + newBlock + remaining;
}

fs.writeFileSync('src/App.tsx', newCode);
