import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  `    if (coaches[u]) {\n      triggerMsg(\`Coach username "\${u}" already exists.\`, 'error');\n      return;\n    }`,
  `    const isTaken = Object.keys(coaches).some(k => k.toLowerCase() === u.toLowerCase());\n    if (isTaken) {\n      triggerMsg(\`Coach username "\${u}" already exists.\`, 'error');\n      return;\n    }`
);

fs.writeFileSync('src/App.tsx', code);
