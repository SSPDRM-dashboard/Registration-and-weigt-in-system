import React, { useState } from 'react';
import { Database, Search, User, Trophy, Edit3, ArrowRight } from 'lucide-react';
import { MasterAthlete, Player } from '../../types';

interface AthleteDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterAthletes: Record<string, MasterAthlete>;
  tournamentPlayers?: Player[];
  dbSearchQuery: string;
  setDbSearchQuery: (query: string) => void;
  saveMasterAthletesToStorage: (athletes: Record<string, MasterAthlete>) => void;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
  onSelectPlayerForEdit?: (p: Player) => void;
}

export const AthleteDatabaseModal: React.FC<AthleteDatabaseModalProps> = ({
  isOpen,
  onClose,
  masterAthletes,
  tournamentPlayers = [],
  dbSearchQuery,
  setDbSearchQuery,
  saveMasterAthletesToStorage,
  triggerMsg,
  onSelectPlayerForEdit,
}) => {
  const [confirmDeleteAthleteId, setConfirmDeleteAthleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'tournament' | 'master'>('all');

  if (!isOpen) return null;

  const q = dbSearchQuery.toLowerCase().trim();

  // 1. Current tournament entrants
  const filteredTournamentPlayers = tournamentPlayers.filter((p) => {
    if (!q) return true;
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.ic && p.ic.toLowerCase().includes(q)) ||
      (p.club && p.club.toLowerCase().includes(q)) ||
      (p.schoolName && p.schoolName.toLowerCase().includes(q)) ||
      (p.event && p.event.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q))
    );
  });

  // 2. Master database saved roster
  const allMasterList = Object.values(masterAthletes) as MasterAthlete[];
  const filteredMasterAthletes = allMasterList.filter((ma) => {
    if (!q) return true;
    return (
      (ma.name && ma.name.toLowerCase().includes(q)) ||
      (ma.ic && ma.ic.toLowerCase().includes(q)) ||
      (ma.club && ma.club.toLowerCase().includes(q))
    );
  });

  const totalFound = activeTab === 'tournament' 
    ? filteredTournamentPlayers.length 
    : activeTab === 'master' 
    ? filteredMasterAthletes.length 
    : filteredTournamentPlayers.length + filteredMasterAthletes.length;

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
              </h2>
              <p className="text-xs text-text-dim">
                Search all current tournament entrants ({tournamentPlayers.length}) and saved master records ({allMasterList.length}).
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

        {/* Search Bar & Tabs */}
        <div className="p-6 border-b border-line bg-surface-2/30 flex flex-col space-y-4 shrink-0">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-text-dim" />
              <input
                type="text"
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                placeholder="Search athlete by name, IC number, club/affiliated team, event..."
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

            <div className="text-xs text-text-dim whitespace-nowrap bg-surface-2 border border-line px-3.5 py-2.5 rounded-xl">
              Found: <span className="font-bold text-gold font-mono">{totalFound} Athletes</span>
            </div>
          </div>

          {/* Scope Filter Tabs */}
          <div className="flex items-center gap-2 border-t border-line/40 pt-3 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-gold text-ink shadow-sm'
                  : 'bg-surface border border-line text-text-dim hover:text-text'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>All Sources ({filteredTournamentPlayers.length + filteredMasterAthletes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tournament')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tournament'
                  ? 'bg-gold text-ink shadow-sm'
                  : 'bg-surface border border-line text-text-dim hover:text-text'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Current Tournament Entrants ({filteredTournamentPlayers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('master')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'master'
                  ? 'bg-gold text-ink shadow-sm'
                  : 'bg-surface border border-line text-text-dim hover:text-text'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Master Saved Profiles ({filteredMasterAthletes.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-grow space-y-6">
          {totalFound === 0 ? (
            <div className="text-center py-16 text-text-dim space-y-2">
              <Database className="w-12 h-12 text-line mx-auto mb-2" />
              <p className="font-bold text-sm">No athlete records found matching "{dbSearchQuery}".</p>
              <p className="text-xs">Try searching by partial name or IC/Passport number.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section 1: Current Tournament Entrants */}
              {(activeTab === 'all' || activeTab === 'tournament') && filteredTournamentPlayers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-line">
                    <Trophy className="w-4 h-4 text-gold" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                      Current Tournament Registered Entrants ({filteredTournamentPlayers.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTournamentPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="bg-surface-2/80 border border-gold/30 rounded-2xl p-4 flex flex-col justify-between hover:border-gold transition shadow-sm space-y-3 relative overflow-hidden"
                      >
                        <div className="absolute top-3 right-3">
                          <span className="text-[9px] bg-gold/20 text-gold font-bold px-2 py-0.5 rounded-full border border-gold/40 uppercase tracking-wider font-mono">
                            Registered
                          </span>
                        </div>

                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-12 rounded-xl bg-ink border border-line flex items-center justify-center text-text-dim shrink-0 overflow-hidden">
                            {p.photo ? (
                              <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-6 h-6 text-line" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-16">
                            <h3 className="font-bold text-text text-sm uppercase truncate font-display">{p.name}</h3>
                            <p className="text-xs text-text-dim font-mono">{p.ic || 'No IC Recorded'}</p>
                            <p className="text-[11px] text-gold font-semibold mt-0.5 truncate">{p.club || 'No Club Affiliation'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-ink/50 p-2.5 rounded-xl border border-line/50">
                          <div>
                            <span className="text-text-dim block text-[9px] uppercase font-bold">Event</span>
                            <span className="text-gold font-bold">{p.event || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-text-dim block text-[9px] uppercase font-bold">Category</span>
                            <span className="text-text font-medium">{p.ageGroup || 'N/A'} · {p.gender || ''}</span>
                          </div>
                          <div>
                            <span className="text-text-dim block text-[9px] uppercase font-bold">Division / Weight</span>
                            <span className="text-text font-medium">{p.weightClass || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-text-dim block text-[9px] uppercase font-bold">Entrant ID</span>
                            <span className="text-text font-mono">{p.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-text-dim">
                            Registered Entry
                          </span>
                          {onSelectPlayerForEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectPlayerForEdit(p);
                                onClose();
                                triggerMsg(`Selected ${p.name} for editing.`, 'ok');
                              }}
                              className="bg-gold text-ink hover:bg-gold-hover px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Entrant</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Master Saved Profiles */}
              {(activeTab === 'all' || activeTab === 'master') && filteredMasterAthletes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-line pt-2">
                    <User className="w-4 h-4 text-text-dim" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim">
                      Saved Master Profiles ({filteredMasterAthletes.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredMasterAthletes.map((ma) => (
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
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-line bg-surface-2 text-center text-xs text-text-dim shrink-0">
          Note: Searching scans both registered entries for this tournament and your browser's saved master athlete database.
        </div>
      </div>
    </div>
  );
};

