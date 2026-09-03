import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Check, 
  Shield, 
  Award, 
  UserCheck, 
  Crown, 
  Gamepad2, 
  Cpu, 
  Layers, 
  User, 
  AlertCircle,
  Save,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { Competition, Referee } from '../../types';

interface AssignSpecialRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeComp: Competition | null;
  referees: Referee[];
  refereeAccounts: Referee[];
  onAssignSpecialRole: (refereeId: string, role: Referee['specialRole']) => Promise<void>;
  onEditFullProfile: (ref: Referee) => void;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

interface RoleDefinition {
  value: NonNullable<Referee['specialRole']>;
  label: string;
  shortLabel: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const SPECIAL_ROLES: RoleDefinition[] = [
  {
    value: 'None',
    label: 'Standard Referee',
    shortLabel: 'Standard',
    badgeColor: 'text-slate-300',
    badgeBg: 'bg-slate-700/40',
    badgeBorder: 'border-slate-600/60',
    description: 'General ring and court duties (Center Referee, Corner Judge, Technical Assistant).',
    icon: User,
  },
  {
    value: 'RIC',
    label: 'Referee In-Charge (RIC)',
    shortLabel: 'RIC',
    badgeColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/40',
    description: 'Chief referee manager. Oversees ring assignments, court rosters, and daily officiating operations.',
    icon: Crown,
  },
  {
    value: 'TD',
    label: 'Technical Delegate (TD)',
    shortLabel: 'TD',
    badgeColor: 'text-blue-400',
    badgeBg: 'bg-blue-500/15',
    badgeBorder: 'border-blue-500/40',
    description: 'Governing official appointed to ensure competition rules, tournament validity, and sanction compliance.',
    icon: Shield,
  },
  {
    value: 'CSB',
    label: 'Competition Supervisory Board (CSB)',
    shortLabel: 'CSB',
    badgeColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/15',
    badgeBorder: 'border-purple-500/40',
    description: 'Deliberates on protests, arbitration, and appeals during tournament proceedings.',
    icon: Award,
  },
  {
    value: 'GAME_MASTER',
    label: 'Game Master (GM) - Virtual TKD',
    shortLabel: 'GM',
    badgeColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/40',
    description: 'Orchestrates Virtual Taekwondo gameplay, refereeing stations, and ring logistics.',
    icon: Gamepad2,
  },
  {
    value: 'TECHNICAL_OPERATOR',
    label: 'Technical Operator (TO) - Virtual TKD',
    shortLabel: 'TO',
    badgeColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/15',
    badgeBorder: 'border-cyan-500/40',
    description: 'Operates VR headsets, motion tracking hardware, and technical scoring servers.',
    icon: Cpu,
  },
  {
    value: 'VIRTUAL_REFEREE',
    label: 'Virtual Referee (VR) - Virtual TKD',
    shortLabel: 'VR',
    badgeColor: 'text-rose-400',
    badgeBg: 'bg-rose-500/15',
    badgeBorder: 'border-rose-500/40',
    description: 'Officiates Virtual Taekwondo bouts, supervising competitors and virtual boundaries.',
    icon: Layers,
  },
];

export const AssignSpecialRolesModal: React.FC<AssignSpecialRolesModalProps> = ({
  isOpen,
  onClose,
  activeComp,
  referees,
  onAssignSpecialRole,
  onEditFullProfile,
  triggerMsg,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Referee['specialRole']>('None');
  const [isSaving, setIsSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'special' | 'standard'>('all');

  // Tourney referees
  const tournamentReferees = useMemo(() => {
    if (!activeComp?.id) return [];
    return referees.filter((r) => r.compId === activeComp.id);
  }, [referees, activeComp?.id]);

  // Filtered referees
  const filteredReferees = useMemo(() => {
    return tournamentReferees.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.fullName.toLowerCase().includes(q) ||
        (r.nric || '').toLowerCase().includes(q) ||
        (r.clubName || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const hasSpecial = r.specialRole && r.specialRole !== 'None';
      if (activeFilter === 'special') return hasSpecial;
      if (activeFilter === 'standard') return !hasSpecial;
      return true;
    });
  }, [tournamentReferees, searchQuery, activeFilter]);

  // Selected referee object
  const currentRef = useMemo(() => {
    return tournamentReferees.find((r) => r.id === selectedRefId) || null;
  }, [tournamentReferees, selectedRefId]);

  // When a referee is selected, sync their current special role
  const handleSelectReferee = (ref: Referee) => {
    setSelectedRefId(ref.id);
    setSelectedRole(ref.specialRole || 'None');
  };

  // If no referee is selected yet, pre-select the first matching one
  React.useEffect(() => {
    if (isOpen && !selectedRefId && tournamentReferees.length > 0) {
      handleSelectReferee(tournamentReferees[0]);
    }
  }, [isOpen, selectedRefId, tournamentReferees]);

  if (!isOpen || !activeComp) return null;

  const handleSaveRole = async () => {
    if (!currentRef) {
      triggerMsg('Please select a referee first.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await onAssignSpecialRole(currentRef.id, selectedRole);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToStandard = async () => {
    if (!currentRef) return;
    setIsSaving(true);
    try {
      await onAssignSpecialRole(currentRef.id, 'None');
      setSelectedRole('None');
    } finally {
      setIsSaving(false);
    }
  };

  const specialOfficials = tournamentReferees.filter(
    (r) => r.specialRole && r.specialRole !== 'None'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#151923] border border-line rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-line flex justify-between items-center bg-[#181d2a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                Referee Roles Configuration
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                Assign and configure special appointments for{' '}
                <span className="text-gold font-bold">{activeComp.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-dim hover:text-white transition p-2 hover:bg-white/5 rounded-xl cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Referee Search & Selector (5 cols) */}
            <div className="lg:col-span-5 space-y-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gold uppercase tracking-wider">
                  Tournament Referees ({tournamentReferees.length})
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      activeFilter === 'all'
                        ? 'bg-gold text-ink'
                        : 'bg-ink text-text-dim hover:text-white'
                    }`}
                  >
                    All ({tournamentReferees.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('special')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      activeFilter === 'special'
                        ? 'bg-gold text-ink'
                        : 'bg-ink text-text-dim hover:text-white'
                    }`}
                  >
                    Appointed ({specialOfficials.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('standard')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      activeFilter === 'standard'
                        ? 'bg-gold text-ink'
                        : 'bg-ink text-text-dim hover:text-white'
                    }`}
                  >
                    Standard
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, NRIC, or phone..."
                  className="w-full bg-[#0d1017] border border-line rounded-xl pl-9 pr-8 py-2.5 text-xs text-text outline-none focus:border-gold transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-white text-xs p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Referees List */}
              <div className="bg-[#0d1017] border border-line/80 rounded-2xl p-2 space-y-1.5 max-h-[360px] overflow-y-auto custom-scrollbar flex-1">
                {filteredReferees.length === 0 ? (
                  <div className="text-center py-10 px-4 text-xs text-text-dim">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-text-dim/60" />
                    No referees found matching your criteria.
                  </div>
                ) : (
                  filteredReferees.map((r) => {
                    const isSelected = r.id === selectedRefId;
                    const hasSpecial = r.specialRole && r.specialRole !== 'None';
                    const roleDef = SPECIAL_ROLES.find((d) => d.value === r.specialRole);

                    return (
                      <div
                        key={r.id}
                        onClick={() => handleSelectReferee(r)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-gold/10 border-gold/60 shadow-sm'
                            : 'bg-surface/60 border-line/60 hover:bg-surface hover:border-line'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white truncate">
                              {r.fullName}
                            </span>
                            {hasSpecial ? (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                                  roleDef?.badgeBg || 'bg-amber-500/15'
                                } ${roleDef?.badgeColor || 'text-amber-400'} ${
                                  roleDef?.badgeBorder || 'border-amber-500/40'
                                }`}
                              >
                                {r.specialRole}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-mono text-text-dim bg-white/5 border border-line/40">
                                Standard
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-text-dim flex items-center gap-2 mt-0.5">
                            <span>{r.phone || 'No phone'}</span>
                            {r.clubName && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[120px]">{r.clubName}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <span className="w-5 h-5 rounded-full bg-gold text-ink flex items-center justify-center text-xs font-black">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectReferee(r);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-ink border border-line text-text-dim hover:text-white hover:border-gold/50 transition cursor-pointer"
                            >
                              {hasSpecial ? 'Edit' : 'Select'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Role Configuration Panel (7 cols) */}
            <div className="lg:col-span-7 bg-[#10131c] border border-line rounded-2xl p-5 space-y-5 flex flex-col justify-between">
              {currentRef ? (
                <>
                  {/* Selected Referee Banner */}
                  <div className="space-y-4">
                    <div className="bg-[#161b27] border border-line/90 p-4 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold font-black text-sm uppercase">
                          {currentRef.fullName.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm text-white">{currentRef.fullName}</h3>
                            <span className="text-[10px] font-mono text-text-dim">
                              {currentRef.nric || 'N/A'}
                            </span>
                          </div>
                          <p className="text-xs text-text-dim mt-0.5">
                            {currentRef.clubName || 'No Club Specified'} •{' '}
                            {currentRef.phone || 'No Phone'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onEditFullProfile(currentRef)}
                        className="text-xs font-bold text-gold hover:text-yellow-300 hover:underline flex items-center gap-1 cursor-pointer transition"
                        title="Edit complete referee profile and banking info"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Edit Full Profile
                      </button>
                    </div>

                    {/* Role Selection Options */}
                    <div>
                      <label className="block text-xs font-black text-gold uppercase tracking-wider mb-2">
                        Select Special Role Appointment
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {SPECIAL_ROLES.map((role) => {
                          const isRoleSelected = selectedRole === role.value;
                          const RoleIcon = role.icon;

                          return (
                            <div
                              key={role.value}
                              onClick={() => setSelectedRole(role.value)}
                              className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between text-left ${
                                isRoleSelected
                                  ? `${role.badgeBg} ${role.badgeBorder} shadow-md ring-1 ring-gold/40`
                                  : 'bg-[#151923] border-line/60 hover:bg-[#1a202d] hover:border-line'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                      isRoleSelected
                                        ? 'bg-gold text-ink'
                                        : 'bg-white/5 text-text-dim'
                                    }`}
                                  >
                                    <RoleIcon className="w-3.5 h-3.5" />
                                  </div>
                                  <span
                                    className={`text-xs font-black ${
                                      isRoleSelected ? 'text-white' : 'text-slate-200'
                                    }`}
                                  >
                                    {role.label}
                                  </span>
                                </div>
                                {isRoleSelected && (
                                  <span className="w-4 h-4 rounded-full bg-gold text-ink flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-text-dim leading-relaxed">
                                {role.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 border-t border-line/70 flex items-center justify-between gap-3 flex-wrap">
                    {currentRef.specialRole && currentRef.specialRole !== 'None' ? (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleResetToStandard}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revoke Role (Reset to Standard)
                      </button>
                    ) : (
                      <div className="text-xs text-text-dim">
                        Currently: <span className="text-slate-400 font-semibold">Standard Referee</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-text-dim hover:text-white border border-line transition cursor-pointer"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSaveRole}
                        className="bg-gold hover:bg-yellow-400 text-ink font-black text-xs px-5 py-2 rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving Role...' : 'Save Role Assignment'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 px-4 flex flex-col items-center justify-center text-text-dim space-y-3">
                  <UserCheck className="w-10 h-10 text-gold/40" />
                  <div>
                    <h4 className="font-bold text-white text-sm">No Referee Selected</h4>
                    <p className="text-xs text-text-dim max-w-sm mt-1">
                      Choose a referee from the left column to view their details and assign their
                      special role for this tournament.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Currently Appointed Special Officials Overview Table */}
          <div className="bg-[#10131c] border border-line/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Crown className="w-4 h-4 text-gold" />
                Currently Appointed Tournament Officials ({specialOfficials.length})
              </h4>
              <span className="text-[10px] text-text-dim font-medium">
                RIC, TD, CSB, and Virtual Officials
              </span>
            </div>

            {specialOfficials.length === 0 ? (
              <p className="text-xs text-text-dim py-3">
                No special appointments configured yet for this tournament. Select a referee above to
                assign an official role.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {specialOfficials.map((ref) => {
                  const roleDef = SPECIAL_ROLES.find((d) => d.value === ref.specialRole);
                  return (
                    <div
                      key={ref.id}
                      className="bg-[#161b27] border border-line/90 p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-black text-xs text-white truncate">{ref.fullName}</div>
                        <div className="text-[10px] text-text-dim mt-0.5">
                          {ref.phone || ref.nric}
                        </div>
                        <div className="mt-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                              roleDef?.badgeBg || 'bg-amber-500/15'
                            } ${roleDef?.badgeColor || 'text-amber-400'} ${
                              roleDef?.badgeBorder || 'border-amber-500/40'
                            }`}
                          >
                            {roleDef?.shortLabel || ref.specialRole}: {roleDef?.label || ''}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectReferee(ref)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 transition cursor-pointer shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
