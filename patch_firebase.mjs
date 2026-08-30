import fs from 'fs';
let code = fs.readFileSync('src/firebase.ts', 'utf-8');

const importStr = "import firebaseConfig from '../firebase-applet-config.json';";
const replacement = `const configs = import.meta.glob('../firebase-applet-config.json', { eager: true });
let firebaseConfig: any = {};
if (configs['../firebase-applet-config.json']) {
  firebaseConfig = (configs['../firebase-applet-config.json'] as any).default || configs['../firebase-applet-config.json'];
} else {
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}`;

code = code.replace(importStr, replacement);
fs.writeFileSync('src/firebase.ts', code);
