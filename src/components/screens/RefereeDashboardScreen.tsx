import React, { useState } from 'react';
import { 
  Trophy, 
  MapPin, 
  Calendar, 
  Edit, 
  Phone, 
  CreditCard, 
  Car, 
  Building2, 
  CheckCircle2, 
  ExternalLink, 
  ChevronRight, 
  Scale, 
  DollarSign, 
  Maximize2, 
  User, 
  Sparkles,
  Info,
  Clock,
  Briefcase,
  X,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Competition, Referee } from '../../types';
import { RefereeFeesConfig } from '../../utils';

interface RefereeDashboardScreenProps {
  user: string | null;
  activeReferee: Referee | null;
  referees: Referee[];
  competitions: Competition[];
  compId: string | null;
  setCompId: (id: string | null) => void;
  setScreen: (screen: any) => void;
  refereeAccounts: Referee[];
  refereeFees: RefereeFeesConfig;
  formatDateRange: (start?: string, end?: string) => string;
  getRefereeAllowance: (ref: Referee, fees: RefereeFeesConfig, compCurrency?: string) => {
    dailyRate: number;
    days: number;
    baseDutyPay: number;
    travelPay: number;
    otPay: number;
    othersPay: number;
    totalPay: number;
    isSplit: boolean;
  };
  onEditProfile: () => void;
  setEnlargedPhoto: (photoData: { url: string; title: string; subtitle?: string; metadata?: { label: string; value: string }[] } | null) => void;
  onRegisterForComp?: (comp: Competition) => void;
  onWithdrawComp?: (comp: Competition) => Promise<void> | void;
  myRefereeRegistrations?: Referee[];
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

export const RefereeDashboardScreen: React.FC<RefereeDashboardScreenProps> = ({
  user,
  activeReferee,
  referees,
  competitions,
  compId,
  setCompId,
  setScreen,
  refereeAccounts,
  refereeFees,
  formatDateRange,
  getRefereeAllowance,
  onEditProfile,
  setEnlargedPhoto,
  onRegisterForComp,
  onWithdrawComp,
  myRefereeRegistrations,
  triggerMsg,
}) => {
  const [compToWithdraw, setCompToWithdraw] = useState<Competition | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const cleanUser = (user || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  // Find global account or current referee object
  const globalAccount = refereeAccounts.find(
    a => (a.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanUser
  );

  // All tournament entries for this referee
  const myTournamentRefs = myRefereeRegistrations && myRefereeRegistrations.length > 0
    ? myRefereeRegistrations
    : referees.filter(
        r => (r.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanUser
      );

  // Active competition data
  const currentComp = competitions.find(c => c.id === compId);
  const activeCompRef = myTournamentRefs.find(r => r.compId === compId) || activeReferee;
  const compCurrency = currentComp?.currency || refereeFees.currency || 'RM';

  // Calculate allowance for current tournament if available
  const currentAllowance = activeCompRef ? getRefereeAllowance(activeCompRef, refereeFees, compCurrency) : null;

  const getRankBadgeClass = (status?: string) => {
    switch (status) {
      case 'IR': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'NR': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'SR': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default: return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  };

  const getRankLabel = (status?: string) => {
    switch (status) {
      case 'IR': return 'International Referee (IR)';
      case 'NR': return 'National Referee (NR)';
      case 'SR': return 'State Referee (SR)';
      default: return 'Tournament Referee (TR)';
    }
  };

  const refPhoto = activeCompRef?.photo || globalAccount?.photo || '';
  const refName = activeCompRef?.fullName || globalAccount?.fullName || 'Referee';
  const refNric = activeCompRef?.nric || globalAccount?.nric || user || 'N/A';
  const refClub = activeCompRef?.clubName || globalAccount?.clubName || 'Independent';
  const refPhone = activeCompRef?.phone || globalAccount?.phone || 'N/A';
  const refCar = activeCompRef?.carPlate || globalAccount?.carPlate || 'N/A';
  const refBank = activeCompRef?.bankName || globalAccount?.bankName || 'MAYBANK';
  const refAccount = activeCompRef?.bankAccount || globalAccount?.bankAccount || 'N/A';
  const refKyorugi = activeCompRef?.kyorugiStatus || globalAccount?.kyorugiStatus || 'TR';
  const refPoomsae = activeCompRef?.poomsaeStatus || globalAccount?.poomsaeStatus || 'TR';
  const refSpecialRole = activeCompRef?.specialRole || 'None';
  const refDistance = activeCompRef?.distance ?? globalAccount?.distance ?? 0;
  const refLocation = activeCompRef?.residentialLocation || globalAccount?.residentialLocation || 'Not Specified';

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Banner / Referee Identity Profile */}
      <div className="bg-surface border border-line rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-5">
            {/* Photo Thumbnail with Lightbox click */}
            <div 
              className={`relative group/photo shrink-0 ${refPhoto ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (refPhoto) {
                  setEnlargedPhoto({
                    url: refPhoto,
                    title: refName,
                    subtitle: `Referee Profile • ${refClub}`,
                    metadata: [
                      { label: 'NRIC / IC No', value: refNric },
                      { label: 'Registered Phone', value: refPhone },
                      { label: 'Club / State', value: refClub },
                      { label: 'Kyorugi Rank', value: getRankLabel(refKyorugi) },
                      { label: 'Poomsae Rank', value: getRankLabel(refPoomsae) },
                      { label: 'Special Role', value: refSpecialRole !== 'None' ? refSpecialRole : 'Official Referee' },
                      { label: 'Bank Account', value: `${refBank}: ${refAccount}` },
                      { label: 'Vehicle Plate', value: refCar },
                      { label: 'Residential Origin', value: refLocation },
                      { label: 'Round-Trip Distance', value: `${refDistance} KM` }
                    ]
                  });
                }
              }}
            >
              {refPhoto ? (
                <div className="relative">
                  <img 
                    src={refPhoto} 
                    alt={refName} 
                    className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border-2 border-line hover:border-gold shadow-md transition-all duration-200 group-hover/photo:scale-105" 
                  />
                  <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity">
                    <Maximize2 className="w-5 h-5 text-white drop-shadow" />
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-ink border border-line flex items-center justify-center text-text-dim shadow-inner">
                  <User className="w-10 h-10" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold uppercase tracking-wide text-white font-sans">
                  {refName}
                </h1>
                {refSpecialRole && refSpecialRole !== 'None' && (
                  <span className="bg-gold/20 text-gold border border-gold/40 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {refSpecialRole}
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-text-dim italic">
                {refClub} • NRIC: <span className="font-mono text-text font-semibold">{refNric}</span>
              </p>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono border ${getRankBadgeClass(refKyorugi)}`}>
                  Kyorugi: {refKyorugi}
                </span>
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono border ${getRankBadgeClass(refPoomsae)}`}>
                  Poomsae: {refPoomsae}
                </span>
                <span className="bg-ink border border-line text-text-dim px-2.5 py-0.5 rounded-md text-[10px] font-semibold">
                  {refDistance} KM (Go/Ret)
                </span>
              </div>
            </div>
          </div>

          {/* Edit Profile Action */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
            <button
              onClick={onEditProfile}
              className="bg-ink hover:bg-ink/80 border border-line hover:border-gold/60 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Edit className="w-4 h-4 text-gold" /> Edit Profile
            </button>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="mt-6 pt-5 border-t border-line/60 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-ink/40 p-3 rounded-xl border border-line/50">
            <div className="text-text-dim flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider font-semibold">
              <Phone className="w-3.5 h-3.5 text-gold" /> Contact Phone
            </div>
            <div className="font-mono font-medium text-white text-xs sm:text-sm">{refPhone}</div>
          </div>

          <div className="bg-ink/40 p-3 rounded-xl border border-line/50">
            <div className="text-text-dim flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider font-semibold">
              <CreditCard className="w-3.5 h-3.5 text-gold" /> Bank Account
            </div>
            <div className="font-bold text-white uppercase text-xs truncate">{refBank}</div>
            <div className="font-mono text-text-dim text-[11px] tracking-wider">{refAccount}</div>
          </div>

          <div className="bg-ink/40 p-3 rounded-xl border border-line/50">
            <div className="text-text-dim flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider font-semibold">
              <Car className="w-3.5 h-3.5 text-gold" /> Registered Vehicle
            </div>
            <div className="font-mono font-bold text-[#d4af37] text-xs sm:text-sm uppercase tracking-wide">
              {refCar || 'N/A'}
            </div>
          </div>

          <div className="bg-ink/40 p-3 rounded-xl border border-line/50">
            <div className="text-text-dim flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider font-semibold">
              <MapPin className="w-3.5 h-3.5 text-gold" /> Residential City
            </div>
            <div className="font-medium text-white text-xs truncate" title={refLocation}>
              {refLocation}
            </div>
          </div>
        </div>
      </div>

      {/* Active Tournament Duty Card */}
      {currentComp ? (
        <div className="bg-surface border border-line rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-line">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                  Active Officiating Duty
                </span>
                <span className="text-xs text-text-dim font-mono">
                  {currentComp.staffCode ? `ID: ${currentComp.id}` : currentComp.id}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold uppercase text-white mt-1">
                {currentComp.name}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-text-dim mt-1.5">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gold" /> {currentComp.venue}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gold" /> {formatDateRange(currentComp.date, currentComp.endDate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onRegisterForComp && (
                <button
                  type="button"
                  onClick={() => onRegisterForComp(currentComp)}
                  className="bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer shrink-0 active:scale-95"
                  title="Update distance or officiating days for this tournament"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Details
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCompId(null);
                  triggerMsg(`Deselected tournament: ${currentComp.name}`, 'ok');
                }}
                className="bg-ink/60 hover:bg-ink text-text-dim hover:text-white border border-line/80 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                title="Deselect this tournament"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                Deselect
              </button>
              {onWithdrawComp && (
                <button
                  type="button"
                  onClick={() => setCompToWithdraw(currentComp)}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                  title="Withdraw from this tournament"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Withdraw
                </button>
              )}
            </div>
          </div>

          {/* Duty Stats & Payout Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Ring & Role Assignment */}
            <div className="bg-ink/50 border border-line rounded-2xl p-5 space-y-3">
              <div className="text-[11px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-gold" /> Court Duty & Ring
              </div>

              <div className="space-y-2">
                <div className="bg-surface border border-line p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-text-dim">Court Assignment</span>
                  <span className="text-sm font-bold text-white">
                    {activeCompRef?.courtAssignment || 'Court Panel 1'}
                  </span>
                </div>

                <div className="bg-surface border border-line p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-text-dim">Assigned Role</span>
                  <span className="text-sm font-bold text-gold">
                    {activeCompRef?.dutyRole || 'Official Referee'}
                  </span>
                </div>

                {activeCompRef?.matchNo && (
                  <div className="bg-surface border border-line p-3 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-text-dim">Match Schedule</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {activeCompRef.matchNo}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Accommodation & Lodging Details */}
            <div className="bg-ink/50 border border-line rounded-2xl p-5 space-y-3">
              <div className="text-[11px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gold" /> Accommodation
              </div>

              <div className="space-y-2">
                <div className="bg-surface border border-line p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-text-dim">Status</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    activeCompRef?.accommodation === 'Yes'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-slate-700/40 text-slate-300 border border-slate-600/40'
                  }`}>
                    {activeCompRef?.accommodation === 'Yes' ? '🏨 Lodging Provided' : '🏠 No Lodge (Daily Travel)'}
                  </span>
                </div>

                {activeCompRef?.accommodation === 'Yes' && (
                  <>
                    {activeCompRef.hotelCheckoutDate && (
                      <div className="bg-surface border border-line p-3 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-text-dim">Checkout</span>
                        <span className="font-semibold text-white">{activeCompRef.hotelCheckoutDate}</span>
                      </div>
                    )}
                    {activeCompRef.accommodationDetails && (
                      <div className="bg-surface border border-line p-3 rounded-xl text-xs space-y-1">
                        <span className="text-text-dim block text-[10px] uppercase font-bold">Hotel Info</span>
                        <p className="text-white font-medium">{activeCompRef.accommodationDetails}</p>
                      </div>
                    )}
                    {activeCompRef.accommodationMapsLink && (
                      <a
                        href={activeCompRef.accommodationMapsLink}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open Hotel in Google Maps
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 3. Allowance & Payout Estimation */}
            <div className="bg-ink/50 border border-line rounded-2xl p-5 space-y-3">
              <div className="text-[11px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gold" /> Estimated Allowance
              </div>

              {currentAllowance ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-surface border border-line p-3 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-text-dim">
                      <span>Base Officiating ({currentAllowance.days}d @ {compCurrency} {currentAllowance.dailyRate})</span>
                      <span className="font-mono text-white font-medium">{compCurrency} {currentAllowance.baseDutyPay.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-text-dim">
                      <span>Travel Allowance ({activeCompRef?.distance || 0} KM)</span>
                      <span className="font-mono text-white font-medium">{compCurrency} {currentAllowance.travelPay.toFixed(2)}</span>
                    </div>

                    {currentAllowance.otPay > 0 && (
                      <div className="flex justify-between items-center text-text-dim">
                        <span>Overtime (OT)</span>
                        <span className="font-mono text-white font-medium">{compCurrency} {currentAllowance.otPay.toFixed(2)}</span>
                      </div>
                    )}

                    {currentAllowance.othersPay > 0 && (
                      <div className="flex justify-between items-center text-text-dim">
                        <span>Special Role / Others</span>
                        <span className="font-mono text-white font-medium">{compCurrency} {currentAllowance.othersPay.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-gold/10 border border-gold/40 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-gold">Total Estimated Payout</div>
                      <div className="text-xl font-black text-gold font-mono">{compCurrency} {currentAllowance.totalPay.toFixed(2)}</div>
                    </div>
                    <div className="text-right text-[10px] text-text-dim">
                      Auto-credited to<br/>
                      <strong className="text-white uppercase">{refBank}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-surface border border-line rounded-xl text-center text-xs text-text-dim">
                  Duty payout calculation pending assignment confirmation.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-line/80 rounded-3xl p-6 md:p-8 shadow-xl text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/25 flex items-center justify-center mx-auto text-gold">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              No Tournament Selected
            </h3>
            <p className="text-xs text-text-dim max-w-md mx-auto mt-1">
              Select a tournament from the list below to view your court assignments, ring duties, and payout calculation, or register to officiate an upcoming tournament.
            </p>
          </div>
        </div>
      )}

      {/* Tournaments Selection & Registration List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h3 className="text-sm font-bold text-text-dim uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold" />
            <span>Select or Switch Tournament</span>
          </h3>
          <div className="flex items-center gap-3">
            {compId && (
              <button
                type="button"
                onClick={() => {
                  setCompId(null);
                  triggerMsg('Deselected active tournament.', 'ok');
                }}
                className="text-xs text-gold hover:text-yellow-300 hover:underline flex items-center gap-1 font-bold cursor-pointer transition"
                title="Clear current tournament selection"
              >
                <X className="w-3.5 h-3.5" />
                Deselect Active Tournament
              </button>
            )}
            <span className="text-xs text-text-dim">
              {competitions.filter(c => c.isActive !== false).length} Active Tournaments
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.filter(c => c.isActive !== false).length === 0 ? (
            <div className="col-span-full bg-surface p-8 rounded-2xl border border-line text-center">
              <Trophy className="w-8 h-8 text-text-dim/50 mx-auto mb-2" />
              <p className="text-sm text-text-dim uppercase tracking-wider">No active tournaments available</p>
            </div>
          ) : (
            competitions
              .filter(c => c.isActive !== false)
              .map(c => {
                const isCurrent = c.id === compId;
                const isRegistered = myTournamentRefs.some(r => r.compId === c.id);
                const tournamentRef = myTournamentRefs.find(r => r.compId === c.id);
                const tourAllowance = tournamentRef ? getRefereeAllowance(tournamentRef, refereeFees, c.currency) : null;

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (isCurrent) {
                        setCompId(null);
                        triggerMsg(`Deselected ${c.name}.`, 'ok');
                      } else if (!isRegistered && onRegisterForComp) {
                        onRegisterForComp(c);
                      } else {
                        setCompId(c.id);
                        triggerMsg(`Switched active tournament to ${c.name}`, 'ok');
                      }
                    }}
                    className={`bg-surface border rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 shadow-sm group relative overflow-hidden ${
                      isCurrent 
                        ? 'border-gold shadow-gold/10 ring-1 ring-gold' 
                        : 'border-line hover:border-gold/50'
                    }`}
                  >
                    {isCurrent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompId(null);
                          triggerMsg(`Deselected ${c.name}.`, 'ok');
                        }}
                        className="absolute top-0 right-0 bg-gold hover:bg-yellow-400 text-ink text-[9px] font-black uppercase px-2.5 py-1 rounded-bl-xl tracking-wider flex items-center gap-1 cursor-pointer transition shadow-sm"
                        title="Click to deselect"
                      >
                        <span>Selected</span>
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    <div className="flex justify-between items-start mb-3">
                      <div className={`p-2.5 rounded-xl border ${
                        isCurrent ? 'bg-gold/20 text-gold border-gold/40' : 'bg-ink text-text-dim border-line'
                      }`}>
                        <Trophy className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-dim group-hover:text-gold transition-colors" />
                    </div>

                    <h4 className="text-base font-bold text-white font-sans uppercase leading-tight group-hover:text-gold transition-colors line-clamp-1">
                      {c.name}
                    </h4>

                    <div className="mt-2.5 space-y-1 text-xs text-text-dim">
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-gold shrink-0" /> {c.venue}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gold shrink-0" /> {formatDateRange(c.date, c.endDate)}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-xs gap-2 flex-wrap">
                      {isRegistered ? (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Registered
                            </span>
                            {onRegisterForComp && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRegisterForComp(c);
                                }}
                                className="text-[10px] text-text-dim hover:text-gold underline font-bold cursor-pointer"
                                title="Update distance & officiating days"
                              >
                                Edit Details
                              </button>
                            )}
                            {isCurrent && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCompId(null);
                                  triggerMsg(`Deselected ${c.name}.`, 'ok');
                                }}
                                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
                                title="Deselect this tournament"
                              >
                                Deselect
                              </button>
                            )}
                            {onWithdrawComp && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCompToWithdraw(c);
                                }}
                                className="text-[10px] text-rose-400/90 hover:text-rose-300 underline font-bold cursor-pointer"
                                title="Withdraw from tournament"
                              >
                                Withdraw
                              </button>
                            )}
                          </div>
                          {tourAllowance && (
                            <span className="font-mono font-bold text-gold shrink-0">
                              {c.currency || refereeFees.currency || 'RM'} {tourAllowance.totalPay.toFixed(2)}
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="w-full flex items-center justify-between">
                          <span className="text-amber-400/90 text-[11px] font-medium flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" /> Submission Required
                          </span>
                          {onRegisterForComp && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRegisterForComp(c);
                              }}
                              className="text-xs bg-gold text-ink hover:bg-yellow-400 border border-gold px-3 py-1.5 rounded-xl font-black transition shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              Join Tournament
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Confirmation Modal to Withdraw from Tournament */}
      {compToWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#181d28] border border-line rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="bg-rose-500/15 p-3 rounded-2xl border border-rose-500/30 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Withdraw From Tournament?
                </h3>
                <p className="text-xs text-text-dim mt-1">
                  Are you sure you want to de-register and withdraw from <span className="font-bold text-white">{compToWithdraw.name}</span>?
                </p>
              </div>
            </div>

            <div className="bg-[#121620] border border-line/60 p-3.5 rounded-2xl text-xs space-y-1.5 text-text-dim">
              <p className="text-amber-300 font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" /> Note regarding withdrawal:
              </p>
              <p>
                Your officiating registration, mileage claim, and ring duty assignment for this tournament will be removed. You can re-join anytime before tournament commencement.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isWithdrawing}
                onClick={() => setCompToWithdraw(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-dim hover:text-white hover:bg-white/5 border border-line transition cursor-pointer"
              >
                Keep Registration
              </button>
              <button
                type="button"
                disabled={isWithdrawing}
                onClick={async () => {
                  if (onWithdrawComp) {
                    setIsWithdrawing(true);
                    try {
                      await onWithdrawComp(compToWithdraw);
                    } finally {
                      setIsWithdrawing(false);
                      setCompToWithdraw(null);
                    }
                  } else {
                    setCompToWithdraw(null);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isWithdrawing ? 'Withdrawing...' : 'Confirm Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
