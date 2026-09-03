import React, { useState } from 'react';
import { Database, Search, User } from 'lucide-react';
import { MasterAthlete } from '../../types';

interface AthleteDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterAthletes: Record<string, MasterAthlete>;
  dbSearchQuery: string;
  setDbSearchQuery: (query: string) => void;
  saveMasterAthletesToStorage: (athletes: Record<string, MasterAthlete>) => void;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

export const AthleteDatabaseModal: React.FC<AthleteDatabaseModalProps> = ({
  isOpen,
  onClose,
  masterAthletes,
  dbSearchQuery,
  setDbSearchQuery,
  saveMasterAthletesToStorage,
  triggerMsg,
}) => {
  const [confirmDeleteAthleteId, setConfirmDeleteAthleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const q = dbSearchQuery.toLowerCase();
  const allList = Object.values(masterAthletes) as MasterAthlete[];
  const filtered = allList.filter(
    (ma) =>
      ma.name.toLowerCase().includes(q) ||
      (ma.ic && ma.ic.toLowerCase().includes(q)) ||
      (ma.club && ma.club.toLowerCase().includes(q))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in print:hidden">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-line bg-gradient-to-b from-surface-2/50 to-transparent flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display flex items-center gap-2">
                <span>Athlete Database Explorer & Search Engine</span>
                <span className="text-[10px] bg-gold/15 text-gold px-2 py-0.5 rounded-full border border-gold/20 normal-case font-mono">
                  {Object.keys(masterAthletes).length} Saved
                </span>
              </h2>
              <p className="text-xs text-text-dim">
                Search, browse, inspect, and manage the complete roster of saved registered competitors in local storage.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              setDbSearchQuery('');
            }}
            className="text-text-dim hover:text-text bg-surface-2 hover:bg-line border border-line px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Modal Search Bar */}
        <div className="p-6 border-b border-line bg-surface-2/30 flex flex-col sm:flex-row gap-4 items-center shrink-0">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-text-dim" />
            <input
              type="text"
              value={dbSearchQuery}
              onChange={(e) => setDbSearchQuery(e.target.value)}
              placeholder="Search saved database by name, IC number, club/affiliated team..."
              className="w-full bg-ink border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-text outline-none focus:border-gold transition shadow-inner"
            />
            {dbSearchQuery && (
              <button
                onClick={() => setDbSearchQuery('')}
                className="absolute right-3.5 top-2.5 text-text-dim hover:text-text font-bold text-lg px-2 py-1 cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          <div className="text-xs text-text-dim whitespace-nowrap bg-surface-2 border border-line px-3 py-2 rounded-xl">
            Filtering: <span className="font-bold text-text">{filtered.length} Athletes</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-grow space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-text-dim space-y-2">
              <Database className="w-12 h-12 text-line mx-auto mb-2" />
              <p className="font-bold text-sm">No athlete records found.</p>
              <p className="text-xs">Try adjusting your search query or add new athletes via registrations.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((ma) => (
                <div
                  key={ma.id}
                  className="bg-surface-2/60 border border-line rounded-2xl p-4 flex flex-col justify-between hover:border-gold/30 transition shadow-sm space-y-3"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-ink border border-line flex items-center justify-center text-text-dim shrink-0 overflow-hidden">
                      {ma.photo ? (
                        <img src={ma.photo} alt={ma.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-line" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-text text-sm uppercase truncate font-display">{ma.name}</h3>
                      <p className="text-xs text-text-dim font-mono">{ma.ic || 'No IC Recorded'}</p>
                      <p className="text-[11px] text-gold font-semibold mt-0.5 truncate">{ma.club || 'No Club Affiliation'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-ink/40 p-2.5 rounded-xl border border-line/50">
                    <div>
                      <span className="text-text-dim block text-[9px] uppercase font-bold">Category</span>
                      <span className="text-text font-medium">{ma.category || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-text-dim block text-[9px] uppercase font-bold">Gender</span>
                      <span className="text-text font-medium">{ma.gender || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-text-dim block text-[9px] uppercase font-bold">Weight Class</span>
                      <span className="text-text font-medium">{ma.weightClass || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-text-dim block text-[9px] uppercase font-bold">Belt Level</span>
                      <span className="text-text font-medium">{ma.belt || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line/50">
                    <span className="text-[10px] font-mono text-text-dim font-bold uppercase tracking-wider">
                      ID: {ma.id}
                    </span>
                    {confirmDeleteAthleteId === ma.id ? (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            const updated = { ...masterAthletes };
                            delete updated[ma.id];
                            saveMasterAthletesToStorage(updated);
                            setConfirmDeleteAthleteId(null);
                            triggerMsg('Athlete profile removed from database successfully!', 'ok');
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteAthleteId(null)}
                          className="bg-surface border border-line text-text hover:bg-line px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteAthleteId(ma.id)}
                        className="text-[10px] text-hong hover:text-white border border-hong/20 hover:bg-hong/90 px-2.5 py-1.5 rounded-lg transition font-bold cursor-pointer"
                      >
                        Delete Profile
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-line bg-surface-2 text-center text-xs text-text-dim shrink-0">
          Note: Persistent profile records are stored securely in your web browser's local sandbox to comply with data privacy policies.
        </div>
      </div>
    </div>
  );
};
