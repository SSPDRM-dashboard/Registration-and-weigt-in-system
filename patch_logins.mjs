import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// handleOrganizerLogin
code = code.replace(
  `  const handleOrganizerLogin = () => {\n    const u = cUser.trim();\n    const p = cPass;\n    const acc = organizers[u];\n    if (!acc || acc.password !== p) {`,
  `  const handleOrganizerLogin = () => {\n    const u = cUser.trim();\n    const p = cPass;\n    const realUsername = Object.keys(organizers).find(k => k.toLowerCase() === u.toLowerCase());\n    const acc = realUsername ? organizers[realUsername] : undefined;\n    if (!acc || acc.password !== p) {`
);
code = code.replace(
  `    setRole('organizer');\n    setUser(u);`,
  `    setRole('organizer');\n    setUser(realUsername || u);`
);

// handleCoachLogin
code = code.replace(
  `  const handleCoachLogin = () => {\n    const u = cUser.trim();\n    const p = cPass;\n    const acc = coaches[u];\n    if (!acc || acc.password !== p) {`,
  `  const handleCoachLogin = () => {\n    const u = cUser.trim();\n    const p = cPass;\n    const realUsername = Object.keys(coaches).find(k => k.toLowerCase() === u.toLowerCase());\n    const acc = realUsername ? coaches[realUsername] : undefined;\n    if (!acc || acc.password !== p) {`
);
code = code.replace(
  `    setRole('coach');\n    setUser(u);`,
  `    setRole('coach');\n    setUser(realUsername || u);`
);

// handleAdminLogin
code = code.replace(
  `    if (aUser.trim() !== 'admin' || aPass !== adminPassword) {`,
  `    if (aUser.trim().toLowerCase() !== 'admin' || aPass !== adminPassword) {`
);

// handleOfficialLogin
code = code.replace(
  `    if (targetComp.staffCode !== oCode) {`,
  `    if (targetComp.staffCode.toLowerCase() !== oCode.toLowerCase()) {`
);

fs.writeFileSync('src/App.tsx', code);
