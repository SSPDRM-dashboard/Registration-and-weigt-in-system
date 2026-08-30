const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// handleOrganizerLogin
code = code.replace(
  `  const handleOrganizerLogin = () => {
    const u = cUser.trim();
    const p = cPass;
    const acc = organizers[u];
    if (!acc || acc.password !== p) {`,
  `  const handleOrganizerLogin = () => {
    const u = cUser.trim();
    const p = cPass;
    const realUsername = Object.keys(organizers).find(k => k.toLowerCase() === u.toLowerCase());
    const acc = realUsername ? organizers[realUsername] : undefined;
    if (!acc || acc.password !== p) {`
);
code = code.replace(
  `    setRole('organizer');
    setUser(u);`,
  `    setRole('organizer');
    setUser(realUsername || u);`
);

// handleCoachLogin
code = code.replace(
  `  const handleCoachLogin = () => {
    const u = cUser.trim();
    const p = cPass;
    const acc = coaches[u];
    if (!acc || acc.password !== p) {`,
  `  const handleCoachLogin = () => {
    const u = cUser.trim();
    const p = cPass;
    const realUsername = Object.keys(coaches).find(k => k.toLowerCase() === u.toLowerCase());
    const acc = realUsername ? coaches[realUsername] : undefined;
    if (!acc || acc.password !== p) {`
);
code = code.replace(
  `    setRole('coach');
    setUser(u);`,
  `    setRole('coach');
    setUser(realUsername || u);`
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
