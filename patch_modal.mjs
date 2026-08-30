import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const modalCode = `      {/* DELETE RING CONFIRMATION MODAL */}
      {ringToDelete && (
`;

const enlargedModalCode = `      {/* ENLARGED PHOTO MODAL */}
      {enlargedPhotoUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            setEnlargedPhotoUrl(null);
            setEnlargedPhotoName(null);
          }}
        >
          <div 
            className="relative bg-slate-950 border border-line rounded-3xl overflow-hidden shadow-2xl max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={() => {
                  setEnlargedPhotoUrl(null);
                  setEnlargedPhotoName(null);
                }}
                className="bg-ink/60 hover:bg-red-500/80 text-white backdrop-blur border border-line/50 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 p-1">
              <img 
                src={enlargedPhotoUrl} 
                alt={enlargedPhotoName || "Enlarged photo"} 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {enlargedPhotoName && (
              <div className="bg-gradient-to-t from-slate-950 to-transparent pt-8 pb-4 px-6 text-center absolute bottom-0 left-0 right-0 pointer-events-none">
                <span className="inline-block bg-ink/80 backdrop-blur-md border border-line px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg uppercase tracking-wider">
                  {enlargedPhotoName}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE RING CONFIRMATION MODAL */}
      {ringToDelete && (
`;

code = code.replace(modalCode, enlargedModalCode);
fs.writeFileSync('src/App.tsx', code);
