const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const enlargeState = `  const [confirmDeleteRefereeId, setConfirmDeleteRefereeId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);
  const [enlargedPhotoName, setEnlargedPhotoName] = useState<string | null>(null);`;

code = code.replace(
  `  const [confirmDeleteRefereeId, setConfirmDeleteRefereeId] = useState<string | null>(null);\n  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);`,
  enlargeState
);

const imgTag = `                                 <div className="w-8 h-10 rounded bg-slate-950 overflow-hidden flex items-center justify-center border border-line shrink-0">
                                   {r.photo ? (
                                     <img 
                                       src={r.photo} 
                                       alt={r.fullName} 
                                       className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition"
                                       onClick={() => {
                                         setEnlargedPhotoUrl(r.photo);
                                         setEnlargedPhotoName(r.fullName);
                                       }}
                                     />
                                   ) : (
                                     <User className="w-4 h-4 text-text-dim/60" />
                                   )}
                                 </div>`;

code = code.replace(
  `                                 <div className="w-8 h-10 rounded bg-slate-950 overflow-hidden flex items-center justify-center border border-line shrink-0">\n                                   {r.photo ? (\n                                     <img src={r.photo} alt={r.fullName} className="w-full h-full object-cover" />\n                                   ) : (\n                                     <User className="w-4 h-4 text-text-dim/60" />\n                                   )}\n                                 </div>`,
  imgTag
);

fs.writeFileSync('src/App.tsx', code);
