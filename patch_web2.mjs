import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace all onClick instances for enlarged photo to include stopPropagation
const pattern = /onClick=\{\(\) => \{\s*setEnlargedPhotoUrl\((.*?)\);\s*setEnlargedPhotoName\((.*?)\);\s*\}\}/g;
const replacement = 'onClick={(e) => { e.stopPropagation(); setEnlargedPhotoUrl($1); setEnlargedPhotoName($2); }}';

code = code.replace(pattern, replacement);

fs.writeFileSync('src/App.tsx', code);
