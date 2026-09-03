import React from 'react';
import { Shield, X, Search, CheckCircle, Clock, Eye, Copy, Share2, ExternalLink } from 'lucide-react';
import { Player } from '../../types';

interface IndemnityDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  user: string | null;
  indemnitySearchQuery: string;
  setIndemnitySearchQuery: (query: string) => void;
  indemnityFilterStatus: 'All' | 'Completed' | 'Pending';
  setIndemnityFilterStatus: (status: 'All' | 'Completed' | 'Pending') => void;
  onViewIndemnity: (player: Player) => void;
  onOpenIndemnityForm?: (player: Player) => void;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

export const IndemnityDashboardModal: React.FC<IndemnityDashboardModalProps> = ({
  isOpen,
  onClose,
  players,
  user,
  indemnitySearchQuery,
  setIndemnitySearchQuery,
  indemnityFilterStatus,
  setIndemnityFilterStatus,
  onViewIndemnity,
  onOpenIndemnityForm,
  triggerMsg,
}) => {
  if (!isOpen) return null;

  const coachAthletesForIndemnity = players.filter((p) => p.coachUsername === user);
  const totalCount = coachAthletesForIndemnity.length;
  const completedCount = coachAthletesForIndemnity.filter((p) => p.indemnityStatus === 'Completed').length;
  const pendingCount = totalCount - completedCount;
  const filteredIndemnityAthletes = coachAthletesForIndemnity.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(indemnitySearchQuery.toLowerCase()) ||
      (p.id && p.id.toLowerCase().includes(indemnitySearchQuery.toLowerCase()));
    const matchesStatus =
      indemnityFilterStatus === 'All' ||
      (indemnityFilterStatus === 'Completed' && p.indemnityStatus === 'Completed') ||
      (indemnityFilterStatus === 'Pending' && p.indemnityStatus !== 'Completed');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in print:hidden">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-line bg-gradient-to-b from-surface-2/50 to-transparent flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display flex items-center gap-2">
                <span>Athlete Indemnity Dashboard</span>
              </h2>
              <p className="text-xs text-text-dim">
                Generate parent links, track real-time authorization status, and review signed consent certificates.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text p-1.5 hover:bg-surface-2 rounded-xl border border-transparent hover:border-line transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-grow space-y-6">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-2 p-4 rounded-2xl border border-line flex items-center justify-between">
              <div>
                <span className="text-xs text-text-dim uppercase font-bold tracking-wider">Total Athletes</span>
                <div className="text-2xl font-bold text-text mt-1">{totalCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-ink flex items-center justify-center text-gold border border-line">
                <Shield className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Signed & Completed</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">{completedCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-900/30 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-amber-950/20 p-4 rounded-2xl border border-amber-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-400 uppercase font-bold tracking-wider">Pending Parent Signature</span>
                <div className="text-2xl font-bold text-amber-400 mt-1">{pendingCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-900/30 flex items-center justify-center text-amber-400 border border-amber-500/30">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search athlete name or ID..."
                value={indemnitySearchQuery}
                onChange={(e) => setIndemnitySearchQuery(e.target.value)}
                className="w-full bg-ink border border-line rounded-xl py-2 pl-9 pr-3 text-xs text-text focus:outline-none focus:border-gold"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-text-dim uppercase font-bold">Filter:</span>
              <div className="flex bg-ink p-1 rounded-xl border border-line">
                {(['All', 'Completed', 'Pending'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setIndemnityFilterStatus(status)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      indemnityFilterStatus === status
                        ? 'bg-gold text-ink shadow-sm'
                        : 'text-text-dim hover:text-text'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Athlete Table */}
          <div className="bg-surface rounded-2xl border border-line overflow-hidden">
            {filteredIndemnityAthletes.length === 0 ? (
              <div className="p-8 text-center text-text-dim text-xs">
                No registered athletes found matching your search and filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 border-b border-line text-text-dim uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-3">Athlete</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Guardian Info</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredIndemnityAthletes.map((athlete) => {
                      const linkUrl = `${window.location.origin}${window.location.pathname}?screen=parentIndemnity&athleteId=${athlete.id}&indemnityComp=${athlete.compId || ''}`;
                      const waText = encodeURIComponent(
                        `Hi Parent/Guardian, please complete and digitally sign the official Taekwondo Tournament Indemnity Form for ${athlete.name}: ${linkUrl}`
                      );
                      const isCompleted = athlete.indemnityStatus === 'Completed';

                      return (
                        <tr key={athlete.id} className="hover:bg-surface-2/40 transition">
                          <td className="p-3">
                            <div className="font-bold text-text uppercase">{athlete.name}</div>
                            <div className="text-[10px] text-text-dim font-mono">{athlete.id}</div>
                          </td>
                          <td className="p-3">
                            <div className="text-text">{athlete.event}</div>
                            <div className="text-[10px] text-text-dim">{athlete.weightClass}</div>
                          </td>
                          <td className="p-3">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle className="w-3 h-3" />
                                Signed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {isCompleted ? (
                              <div>
                                <div className="font-medium text-text">{athlete.indemnityParentName}</div>
                                <div className="text-[10px] text-text-dim">{athlete.indemnityParentPhone}</div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-text-dim italic">Awaiting submission</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {isCompleted ? (
                                <button
                                  onClick={() => onViewIndemnity(athlete)}
                                  className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition cursor-pointer flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Certificate</span>
                                </button>
                              ) : (
                                <>
                                  {onOpenIndemnityForm && (
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onOpenIndemnityForm(athlete);
                                      }}
                                      className="bg-gold/15 hover:bg-gold/25 text-gold border border-gold/30 font-bold px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wide transition cursor-pointer flex items-center gap-1"
                                      title="Open and fill indemnity form directly"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Open Form</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(linkUrl);
                                      triggerMsg('Parent consent link copied to clipboard!', 'ok');
                                    }}
                                    className="bg-surface-2 hover:bg-line border border-line text-text font-bold px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wide transition cursor-pointer flex items-center gap-1"
                                    title="Copy URL to clipboard"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-gold" />
                                    <span>Copy Link</span>
                                  </button>
                                  <button
                                    onClick={() => window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank')}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wide transition cursor-pointer flex items-center gap-1"
                                    title="Send link instantly via WhatsApp"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-line bg-surface-2 text-right shrink-0 flex justify-between items-center text-[10px] text-text-dim">
          <span className="italic">Protip: You can text or email parents directly with the copied links.</span>
          <button
            onClick={onClose}
            className="bg-ink hover:bg-surface border border-line font-bold text-text px-4 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
