import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  `      const matchedCoach = Object.values(coaches).find(c => \n        c.username?.toLowerCase() === uname &&\n        c.name.toLowerCase() === cname &&\n        (c.phone || '').replace(/[^0-9]/g, '') === cphone\n      );`,
  `      const matchedUsername = Object.keys(coaches).find(k => \n        k.toLowerCase() === uname &&\n        coaches[k].name.toLowerCase() === cname &&\n        (coaches[k].phone || '').replace(/[^0-9]/g, '') === cphone\n      );\n      const matchedCoach = matchedUsername ? coaches[matchedUsername] : undefined;`
);

fs.writeFileSync('src/App.tsx', code);
