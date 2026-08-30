import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
    /const userRefsLegacy = referees\.filter\(r => r\.nric\.replace\(\/\[\^a-zA-Z0-9\]\/g, ''\)\.toLowerCase\(\) === cleanIc\);\n\s*if \(userRefsLegacy\.length === 1\) \{\n\s*setCompId\(userRefsLegacy\[0\]\.compId\);\n\s*setActiveReferee\(userRefsLegacy\[0\]\);\n\s*\} else \{\n\s*setCompId\(null\);\n\s*setActiveReferee\(\{\n\s*\.\.\.legacyMatched,\n\s*id: `TEMP_GLOBAL_\$\{cleanIc\}`,\n\s*compId: 'GLOBAL',\n\s*\}\);\n\s*\}/,
    `const userRefsLegacy = referees.filter(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
    const lastCompIdLegacy = localStorage.getItem(\`lastCompId_\${cleanIc}\`);
    const lastRefLegacy = lastCompIdLegacy ? userRefsLegacy.find(r => r.compId === lastCompIdLegacy) : null;

    if (lastRefLegacy) {
      setCompId(lastRefLegacy.compId);
      setActiveReferee(lastRefLegacy);
    } else if (userRefsLegacy.length === 1) {
      setCompId(userRefsLegacy[0].compId);
      setActiveReferee(userRefsLegacy[0]);
    } else {
      setCompId(null);
      setActiveReferee({
        ...legacyMatched,
        id: \`TEMP_GLOBAL_\${cleanIc}\`,
        compId: 'GLOBAL',
      });
    }`
);

fs.writeFileSync('src/App.tsx', code);
