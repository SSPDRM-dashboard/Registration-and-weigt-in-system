import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  `    if (organizers[u]) {\n      triggerMsg('Organizer username already exists.', 'error');\n      return;\n    }`,
  `    const isTaken = Object.keys(organizers).some(k => k.toLowerCase() === u.toLowerCase());\n    if (isTaken) {\n      triggerMsg('Organizer username already exists.', 'error');\n      return;\n    }`
);

fs.writeFileSync('src/App.tsx', code);
