import React from 'react';
import { Scale, Search, X, LayoutGrid, Minimize2, Maximize2, Printer, LogOut, Users } from 'lucide-react';
import { Competition, Referee } from '../../types';

interface CourtRosterDisplayScreenProps {
  activeComp: Competition | null;
  referees: Referee[];
  currentRings: string[];
  fitToWindow: boolean;
  setFitToWindow: (val: boolean) => void;
  rosterSearchQuery: string;
  setRosterSearchQuery: (q: string) => void;
  rosterSelectedRing: string;
  setRosterSelectedRing: (ring: string) => void;
  isFullScreen: boolean;
  toggleFullScreen: () => void;
  role: string | null;
  user: string | null;
  activeReferee: Referee | null;
  setScreen: (screen: any) => void;
}

export const CourtRosterDisplayScreen: React.FC<CourtRosterDisplayScreenProps> = ({
  activeComp,
  referees,
  currentRings,
  fitToWindow,
  setFitToWindow,
  rosterSearchQuery,
  setRosterSearchQuery,
  rosterSelectedRing,
  setRosterSelectedRing,
  isFullScreen,
  toggleFullScreen,
  role,
  user,
  activeReferee,
  setScreen,
}) => {
  return (
    <div
      className={`w-full max-w-[100vw] mx-auto ${
        fitToWindow ? 'space-y-3 px-2 sm:px-4 py-2' : 'max-w-[1600px] space-y-6 p-2 sm:p-4'
      } animate-fade-in`}
    >
      {/* Top Control Bar */}
      <div
        className={`bg-surface border border-line rounded-2xl shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
          fitToWindow ? 'p-3 sm:p-4' : 'p-6'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`${
              fitToWindow ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl'
            } bg-gold/10 border border-gold/40 flex items-center justify-center shrink-0 shadow-inner`}
          >
            <Scale className={`${fitToWindow ? 'w-5 h-5' : 'w-8 h-8'} text-gold`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black bg-emerald-500 text-ink px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                LIVE DISPLAY BOARD
              </span>
              <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                RIC Referee Distribution
              </span>
            </div>
            <h1
              className={`${
                fitToWindow ? 'text-lg sm:text-xl' : 'text-2xl'
              } font-black uppercase tracking-wider text-text font-sans mt-0.5`}
            >
              {activeComp?.name || 'TAEKWONDO CHAMPIONSHIP'}
            </h1>
            <p className="text-[11px] text-text-dim flex items-center gap-2 mt-0.5 flex-wrap">
              <span>
                Venue: <strong className="text-text">{activeComp?.venue || 'Main Arena'}</strong>
              </span>
              <span>•</span>
              <span>
                Total Referees: <strong className="text-gold">{referees.length}</strong>
              </span>
              <span>•</span>
              <span>
                Assigned:{' '}
                <strong className="text-emerald-400">
                  {referees.filter((r) => r.courtAssignment && r.courtAssignment !== 'Unassigned').length}
                </strong>
              </span>
              <span>•</span>
              <span>
                Active Rings: <strong className="text-gold">{currentRings.length}</strong>
              </span>
            </p>
          </div>
        </div>

        {/* Actions & Navigation */}
        <div className="flex items-center gap-2 flex-wrap justify-end w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-48 md:w-56">
            <Search className="w-3.5 h-3.5 text-text-dim absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search referee..."
              value={rosterSearchQuery}
              onChange={(e) => setRosterSearchQuery(e.target.value)}
              className="w-full bg-ink border border-line rounded-xl pl-8 pr-3 py-1.5 text-xs text-text focus:border-gold outline-none"
            />
            {rosterSearchQuery && (
              <button
                onClick={() => setRosterSearchQuery('')}
                className="absolute right-2 top-2 text-text-dim hover:text-text text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Fit Window Toggle Button */}
          <button
            onClick={() => setFitToWindow(!fitToWindow)}
            className={`border text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
              fitToWindow ? 'bg-gold text-ink border-gold' : 'bg-surface-2 hover:bg-line border-line text-text'
            }`}
            title={fitToWindow ? 'Switch to standard height' : 'Fit all rings into single window'}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{fitToWindow ? 'Fit: 1 Window' : 'Fit to Window'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullScreen}
            className="bg-surface-2 hover:bg-line border border-line text-text text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullScreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-gold" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-gold" />
            )}
            <span className="hidden sm:inline">{isFullScreen ? 'Exit Full' : 'Fullscreen'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="bg-surface-2 hover:bg-line border border-line text-text text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-gold" />
            <span>Print Board</span>
          </button>

          <button
            onClick={() => {
              if ((role as string) === 'ric' || user?.startsWith('RIC_')) {
                setScreen('ricDashboard');
              } else if (role === 'referee' || activeReferee) {
                setScreen('refereeDashboard');
              } else {
                setScreen('login');
              }
            }}
            className="bg-gold hover:opacity-90 text-ink text-xs font-bold px-5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit Board</span>
          </button>
        </div>
      </div>

      {/* Ring Filter Bar */}
      <div className="flex items-center justify-between gap-3 bg-surface border border-line p-4 rounded-2xl flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text uppercase tracking-wider">Display Rings:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {['all', ...currentRings].map((ring) => (
            <button
              key={ring}
              onClick={() => setRosterSelectedRing(ring)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition cursor-pointer whitespace-nowrap ${
                rosterSelectedRing === ring
                  ? 'bg-gold text-ink shadow-md'
                  : 'bg-surface-2 text-text-dim hover:text-text border border-line'
              }`}
            >
              {ring === 'all' ? `Show All Rings (${currentRings.length})` : ring}
            </button>
          ))}
        </div>
      </div>

      {/* Rings Grid Board */}
      <div
        className={`grid gap-4 ${
          fitToWindow
            ? currentRings.length === 1
              ? 'grid-cols-1'
              : currentRings.length === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : currentRings.length === 3
              ? 'grid-cols-1 md:grid-cols-3'
              : currentRings.length === 4
              ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
              : currentRings.length <= 6
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
            : currentRings.length === 1
            ? 'grid-cols-1 max-w-xl mx-auto'
            : currentRings.length === 2
            ? 'grid-cols-1 lg:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {currentRings
          .filter((ring) => rosterSelectedRing === 'all' || rosterSelectedRing === ring)
          .map((ringName) => {
            const ringRefs = referees.filter((r) => r.courtAssignment === ringName);
            const matchRange = ringRefs.find((r) => r.matchNo)?.matchNo || '';

            const getRefForRole = (roleKey: string) => {
              return ringRefs.find((r) => {
                const duty = (r.dutyRole || '').trim().toLowerCase();
                const target = roleKey.trim().toLowerCase();
                if (target === 'rj') return duty.includes('rj') || duty.includes('review');
                if (target === 'cr') return duty.includes('cr') || duty.includes('center');
                if (target === 'j1') return duty.includes('j1') || duty.includes('judge 1');
                if (target === 'j2') return duty.includes('j2') || duty.includes('judge 2');
                if (target === 'j3') return duty.includes('j3') || duty.includes('judge 3');
                return false;
              });
            };

            const panelRoles = [
              {
                label: 'Review Jury (RJ)',
                roleKey: 'RJ',
                ref: getRefForRole('RJ'),
                color: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
              },
              {
                label: 'Center Referee (CR)',
                roleKey: 'CR',
                ref: getRefForRole('CR'),
                color: 'border-red-500/40 bg-red-500/10 text-red-400',
              },
              {
                label: 'Judge 1 (J1)',
                roleKey: 'J1',
                ref: getRefForRole('J1'),
                color: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
              },
              {
                label: 'Judge 2 (J2)',
                roleKey: 'J2',
                ref: getRefForRole('J2'),
                color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
              },
              {
                label: 'Judge 3 (J3)',
                roleKey: 'J3',
                ref: getRefForRole('J3'),
                color: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
              },
            ];

            return (
              <div
                key={ringName}
                className="bg-surface border-2 border-line rounded-3xl overflow-hidden shadow-2xl flex flex-col hover:border-gold/50 transition-all duration-300"
              >
                {/* Court Card Header */}
                <div
                  className={`bg-gradient-to-r from-surface to-surface-2 border-b border-line flex flex-col justify-between ${
                    fitToWindow ? 'p-3' : 'p-5'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`${
                          fitToWindow ? 'w-8 h-8 text-xs rounded-lg' : 'w-10 h-10 text-sm rounded-xl'
                        } bg-gold/10 border border-gold/40 flex items-center justify-center font-black text-gold shadow-inner shrink-0`}
                      >
                        {ringName.replace('Ring ', 'R')}
                      </div>
                      <div>
                        <h2
                          className={`${
                            fitToWindow ? 'text-sm sm:text-base' : 'text-xl'
                          } font-black text-gold uppercase tracking-wider`}
                        >
                          {ringName}
                        </h2>
                        {matchRange && (
                          <span className="text-[10px] font-mono font-bold text-gold/90 bg-gold/10 border border-gold/20 px-1.5 py-0.2 rounded inline-block">
                            Match: {matchRange}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-text bg-ink/80 px-2 py-0.5 rounded-lg border border-line shrink-0">
                      {ringRefs.length} Assigned
                    </span>
                  </div>

                  {/* 5 Official Rows */}
                  <div className={`${fitToWindow ? 'space-y-1.5 mt-2' : 'space-y-3 mt-3'}`}>
                    {panelRoles.map(({ label, roleKey, ref, color }) => {
                      const isMatch =
                        rosterSearchQuery.trim() !== '' &&
                        ref &&
                        (ref.fullName.toLowerCase().includes(rosterSearchQuery.toLowerCase()) ||
                          ref.clubName.toLowerCase().includes(rosterSearchQuery.toLowerCase()));
                      return (
                        <div
                          key={label}
                          className={`rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            fitToWindow ? 'p-2' : 'p-3.5'
                          } ${
                            isMatch
                              ? 'bg-gold/20 border-gold ring-2 ring-gold/60 scale-[1.01]'
                              : ref
                              ? 'bg-ink/50 border-line/60 hover:border-text-dim'
                              : 'bg-surface-2/30 border-dashed border-line/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border ${color}`}
                            >
                              {roleKey}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] text-text-dim uppercase font-bold tracking-wider block truncate">
                                {fitToWindow ? roleKey : label}
                              </span>
                              {ref ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-xs text-text tracking-wide truncate max-w-[120px] sm:max-w-none">
                                    {ref.fullName}
                                  </span>
                                  <span className="text-[9px] font-bold text-gold bg-gold/10 px-1 py-0.2 rounded border border-gold/20 shrink-0">
                                    {ref.kyorugiStatus || 'Ref'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-text-dim text-[11px] italic">Unassigned</span>
                              )}
                            </div>
                          </div>
                          {ref && (
                            <div className="text-right shrink-0">
                              <span className="text-[8px] text-text-dim uppercase block font-bold">Match</span>
                              <span className="text-xs font-mono font-bold text-gold">
                                {ref.matchNo || matchRange || '-'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* STANDBY / UNASSIGNED REFEREES HOLDING POOL BOARD */}
      {(() => {
        const unassignedRefs = referees.filter(
          (r) =>
            !r.courtAssignment ||
            r.courtAssignment === 'Unassigned' ||
            !r.dutyRole ||
            r.dutyRole === 'Unassigned'
        );
        const filteredStandby = unassignedRefs.filter((r) => {
          if (!rosterSearchQuery.trim()) return true;
          const q = rosterSearchQuery.toLowerCase();
          return r.fullName.toLowerCase().includes(q) || r.clubName.toLowerCase().includes(q);
        });
        return (
          <div className="bg-surface border-2 border-line rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-line/60 pb-3 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-text text-lg uppercase tracking-wider flex items-center gap-2">
                    <span>Standby Referees Holding Pool</span>
                    <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono px-2.5 py-0.5 rounded-full font-bold">
                      {unassignedRefs.length} Available
                    </span>
                  </h2>
                  <p className="text-xs text-text-dim">
                    Referees currently awaiting ring call from the RIC. Please remain in the referee waiting area.
                  </p>
                </div>
              </div>
            </div>
            {filteredStandby.length === 0 ? (
              <div className="py-8 text-center text-xs text-text-dim italic bg-ink/30 rounded-2xl border border-line/40">
                {unassignedRefs.length === 0
                  ? 'All registered referees are currently distributed on active ring duty panels.'
                  : 'No standby referees matched your search filter.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredStandby.map((r) => (
                  <div
                    key={r.id}
                    className="bg-ink/60 border border-line/60 rounded-xl p-3 flex items-center justify-between gap-2 hover:border-amber-500/40 transition"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-text text-sm block truncate">{r.fullName}</span>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-dim">
                        <span className="text-gold font-bold">
                          {r.kyorugiStatus} / {r.poomsaeStatus}
                        </span>
                        <span>•</span>
                        <span className="truncate">{r.clubName}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded shrink-0 uppercase tracking-wider">
                      Standby
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
