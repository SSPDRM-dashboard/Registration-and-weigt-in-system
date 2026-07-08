const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /\{!\(p\.id\.startsWith\('STAFF-'\) \|\| p\.ageGroup === 'STAFF'\) && \{!\(p\.id\.startsWith\('STAFF-'\) \|\| p\.ageGroup === 'STAFF'\) && /g,
  `{!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && `
);

// We might have a trailing `}` because the replacement inserted `}` at the end of `{!(...) && ...}` but it was already inside `{!(...) && {...}}`.
code = code.replace(
  /\{!\(p\.id\.startsWith\('STAFF-'\) \|\| p\.ageGroup === 'STAFF'\) && <span (.*?)<\/span>\}\}/g,
  `{!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <span $1</span>}`
);

fs.writeFileSync('src/App.tsx', code);
