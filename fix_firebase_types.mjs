import fs from 'fs';
let code = fs.readFileSync('src/firebase.ts', 'utf-8');
code = '/// <reference types="vite/client" />\n' + code;
fs.writeFileSync('src/firebase.ts', code);
