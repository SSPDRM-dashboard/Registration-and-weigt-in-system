import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace the first block (account lookup) - if not already replaced
if (!code.includes('lastCompId_')) {
  code = code.replace(
    /const userRefs = referees\.filter\(r => r\.nric\.replace\(\/\[\^a-zA-Z0-9\]\/g, ''\)\.toLowerCase\(\) === cleanIc\);\n\s*if \(userRefs\.length === 1\) \{\n\s*setCompId\(userRefs\[0\]\.compId\);\n\s*setActiveReferee\(userRefs\[0\]\);\n\s*\} else \{\n\s*setCompId\(null\);\n\s*setActiveReferee\(\{\n\s*\.\.\.account,\n\s*id: `TEMP_GLOBAL_\$\{cleanIc\}`,\n\s*compId: 'GLOBAL',\n\s*\}\);\n\s*\}/,
    `const userRefs = referees.filter(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
      const lastCompId = localStorage.getItem(\`lastCompId_\${cleanIc}\`);
      const lastRef = lastCompId ? userRefs.find(r => r.compId === lastCompId) : null;

      if (lastRef) {
        setCompId(lastRef.compId);
        setActiveReferee(lastRef);
      } else if (userRefs.length === 1) {
        setCompId(userRefs[0].compId);
        setActiveReferee(userRefs[0]);
      } else {
        setCompId(null);
        setActiveReferee({
          ...account,
          id: \`TEMP_GLOBAL_\${cleanIc}\`,
          compId: 'GLOBAL',
        });
      }`
  );

  // Replace the second block (legacy lookup)
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
}
