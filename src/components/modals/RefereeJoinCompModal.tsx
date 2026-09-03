import React from 'react';
import { MapPin, Calendar, X, Check } from 'lucide-react';
import { Competition, Referee } from '../../types';
import { RefereeFeesConfig } from '../../utils';

interface RefereeJoinCompModalProps {
  joiningComp: Competition | null;
  onClose: () => void;
  user: string | null;
  refereeAccounts: Referee[];
  activeReferee?: Referee | null;
  referees?: Referee[];
  joiningDistance: string;
  setJoiningDistance: (distance: string) => void;
  joiningKyorugiDays: string;
  setJoiningKyorugiDays: (days: string) => void;
  joiningPoomsaeDays: string;
  setJoiningPoomsaeDays: (days: string) => void;
  joiningVirtualDays: string;
  setJoiningVirtualDays: (days: string) => void;
  joiningAccommodation: 'Yes' | 'No';
  setJoiningAccommodation: (acc: 'Yes' | 'No') => void;
  refereeFees: RefereeFeesConfig;
  saveRefereeToFirestore: (ref: Referee) => Promise<void>;
  setCompId: (id: string) => void;
  setActiveReferee: (ref: Referee) => void;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

export const RefereeJoinCompModal: React.FC<RefereeJoinCompModalProps> = ({
  joiningComp,
  onClose,
  user,
  refereeAccounts,
  activeReferee,
  referees,
  joiningDistance,
  setJoiningDistance,
  joiningKyorugiDays,
  setJoiningKyorugiDays,
  joiningPoomsaeDays,
  setJoiningPoomsaeDays,
  joiningVirtualDays,
  setJoiningVirtualDays,
  joiningAccommodation,
  setJoiningAccommodation,
  refereeFees,
  saveRefereeToFirestore,
  setCompId,
  setActiveReferee,
  triggerMsg,
}) => {
  if (!joiningComp) return null;

  const cleanIc = (user || activeReferee?.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const account = refereeAccounts.find(
    (a) => (a.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc
  ) || activeReferee;

  const handleConfirm = async () => {
    const parsed = parseFloat(joiningDistance);
    if (isNaN(parsed) || parsed < 0) {
      triggerMsg('Please enter a valid round-trip distance.', 'error');
      return;
    }
    const kDaysNum = parseInt(joiningKyorugiDays) || 0;
    const pDaysNum = parseInt(joiningPoomsaeDays) || 0;
    const vDaysNum = parseInt(joiningVirtualDays) || 0;
    const totalOfficiatingDays = kDaysNum + pDaysNum + vDaysNum;
    if (totalOfficiatingDays <= 0) {
      triggerMsg('Please select at least one event and enter officiating days.', 'error');
      return;
    }
    const refProfile = account || activeReferee;
    if (!refProfile || !refProfile.nric) {
      triggerMsg('Could not find your referee account profile. Please log in again.', 'error');
      return;
    }
    try {
      const cleanRefNric = refProfile.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const existingInComp = referees?.find(
        (r) => r.compId === joiningComp.id && (r.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanRefNric
      );

      const newRef: Referee = {
        ...refProfile,
        ...(existingInComp || {}),
        distance: parsed,
        accommodation: joiningAccommodation,
        kyorugiDays: kDaysNum,
        poomsaeDays: pDaysNum,
        virtualDays: vDaysNum,
        officiatingDays: totalOfficiatingDays,
        id: existingInComp?.id || `${joiningComp.id}_${refProfile.nric.replace(/[^a-zA-Z0-9]/g, '')}`,
        compId: joiningComp.id,
        createdAt: existingInComp?.createdAt || refProfile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveRefereeToFirestore(newRef);
      setCompId(joiningComp.id);
      setActiveReferee(newRef);
      onClose();
      triggerMsg(`Successfully registered for ${joiningComp.name}!`, 'ok');
    } catch (err) {
      console.error('Failed to join tournament:', err);
      triggerMsg('Failed to join tournament.', 'error');
    }
  };

  const kyorugiCount = parseInt(joiningKyorugiDays) || 0;
  const poomsaeCount = parseInt(joiningPoomsaeDays) || 0;
  const virtualCount = parseInt(joiningVirtualDays) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in print:hidden">
      <div className="bg-[#181d28] border border-line rounded-3xl w-full max-w-lg max-h-[92vh] overflow-hidden shadow-2xl flex flex-col animate-scale-up">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-line/60 flex justify-between items-center bg-[#151922] shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gold/15 p-2.5 rounded-2xl border border-gold/30 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                CONFIRM TOURNAMENT DISTANCE
              </h2>
              <p className="text-[11px] text-text-dim">Championships are held at different locations each time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-white transition p-2 hover:bg-white/5 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Tournament & Residence Box */}
          <div className="bg-[#121620] border border-line/70 p-4 rounded-2xl space-y-3">
            <div>
              <span className="text-[10px] text-text-dim uppercase font-bold tracking-wider block">
                TOURNAMENT VENUE
              </span>
              <span className="text-xs sm:text-sm font-bold text-gold flex items-center gap-2 mt-0.5">
                <Calendar className="w-4 h-4 shrink-0 text-gold" />
                {joiningComp.name} ({joiningComp.venue})
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-dim uppercase font-bold tracking-wider block">
                YOUR RESIDENTIAL LOCATION
              </span>
              <span className="text-xs sm:text-sm font-bold text-white uppercase mt-0.5 block tracking-wide">
                {account?.residentialLocation || 'ALOR GAJAH'}
              </span>
            </div>
          </div>

          {/* Distance Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-text uppercase tracking-wider">
              DISTANCE TO VENUE (GO & RETURN IN KM) <span className="text-gold">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="e.g. 230"
                value={joiningDistance}
                onChange={(e) => setJoiningDistance(e.target.value)}
                className="w-full bg-[#121620] border border-line focus:border-gold text-white text-base font-bold rounded-xl py-2.5 px-3.5 focus:outline-none transition font-mono"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-text-dim leading-relaxed">
              Please calculate and provide your actual <strong>round-trip (Go & Return)</strong> mileage distance based on
              Google Maps / Waze between your residence and this specific tournament venue.
            </p>
          </div>

          {/* Events & Officiating Days Stepper */}
          <div className="space-y-2.5 pt-3 border-t border-line/50">
            <label className="block text-xs font-bold text-text uppercase tracking-wider">
              EVENTS & OFFICIATING DAYS <span className="text-gold">*</span>
            </label>
            <div className="space-y-2.5">
              {/* Kyorugi */}
              <div
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  kyorugiCount > 0
                    ? 'bg-[#151922] border-gold/40 shadow-sm'
                    : 'bg-[#121620]/60 border-line/40 hover:border-line'
                }`}
              >
                <div
                  className="flex items-center gap-3 cursor-pointer select-none flex-1"
                  onClick={() => setJoiningKyorugiDays(kyorugiCount > 0 ? '0' : '1')}
                >
                  <input
                    type="checkbox"
                    id="join-kyorugi"
                    checked={kyorugiCount > 0}
                    onChange={(e) => setJoiningKyorugiDays(e.target.checked ? '1' : '0')}
                    className="w-4 h-4 rounded text-gold focus:ring-0 border-line bg-ink accent-gold cursor-pointer"
                  />
                  <span className="text-base">🥋</span>
                  <label
                    htmlFor="join-kyorugi"
                    className="text-xs sm:text-sm font-bold text-white cursor-pointer select-none"
                  >
                    Kyorugi (Sparring)
                  </label>
                </div>
                {kyorugiCount > 0 && (
                  <div className="flex items-center bg-[#1e2330] rounded-lg border border-slate-700/60 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={() => setJoiningKyorugiDays(String(Math.max(1, kyorugiCount - 1)))}
                      className="w-7 h-7 flex items-center justify-center font-bold text-white hover:bg-slate-700/50 transition active:scale-95 cursor-pointer text-xs"
                    >
                      -
                    </button>
                    <span className="w-9 text-center text-xs font-bold text-white font-mono select-none">
                      {kyorugiCount}d
                    </span>
                    <button
                      type="button"
                      onClick={() => setJoiningKyorugiDays(String(kyorugiCount + 1))}
                      className="w-7 h-7 flex items-center justify-center font-bold text-white hover:bg-slate-700/50 transition active:scale-95 cursor-pointer text-xs"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Poomsae */}
              <div
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  poomsaeCount > 0
                    ? 'bg-[#151922] border-gold/40 shadow-sm'
                    : 'bg-[#121620]/60 border-line/40 hover:border-line'
                }`}
              >
                <div
                  className="flex items-center gap-3 cursor-pointer select-none flex-1"
                  onClick={() => setJoiningPoomsaeDays(poomsaeCount > 0 ? '0' : '1')}
                >
                  <input
                    type="checkbox"
                    id="join-poomsae"
                    checked={poomsaeCount > 0}
                    onChange={(e) => setJoiningPoomsaeDays(e.target.checked ? '1' : '0')}
                    className="w-4 h-4 rounded text-gold focus:ring-0 border-line bg-ink accent-gold cursor-pointer"
                  />
                  <span className="text-base">☯️</span>
                  <label
                    htmlFor="join-poomsae"
                    className="text-xs sm:text-sm font-bold text-white cursor-pointer select-none"
                  >
                    Poomsae (Forms)
                  </label>
                </div>
                {poomsaeCount > 0 && (
                  <div className="flex items-center bg-[#1e2330] rounded-lg border border-slate-700/60 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={() => setJoiningPoomsaeDays(String(Math.max(1, poomsaeCount - 1)))}
                      className="w-7 h-7 flex items-center justify-center font-bold text-white hover:bg-slate-700/50 transition active:scale-95 cursor-pointer text-xs"
                    >
                      -
                    </button>
                    <span className="w-9 text-center text-xs font-bold text-white font-mono select-none">
                      {poomsaeCount}d
                    </span>
                    <button
                      type="button"
                      onClick={() => setJoiningPoomsaeDays(String(poomsaeCount + 1))}
                      className="w-7 h-7 flex items-center justify-center font-bold text-white hover:bg-slate-700/50 transition active:scale-95 cursor-pointer text-xs"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Virtual */}
              <div
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  virtualCount > 0
                    ? 'bg-[#151922] border-gold/40 shadow-sm'
                    : 'bg-[#121620]/60 border-line/40 hover:border-line'
                }`}
              >
                <div
                  className="flex items-center gap-3 cursor-pointer select-none flex-1"
                  onClick={() => setJoiningVirtualDays(virtualCount > 0 ? '0' : '1')}
                >
                  <input
                    type="checkbox"
                    id="join-virtual"
                    checked={virtualCount > 0}
                    onChange={(e) => setJoiningVirtualDays(e.target.checked ? '1' : '0')}
                    className="w-4 h-4 rounded text-gold focus:ring-0 border-line bg-ink accent-gold cursor-pointer"
                  />
                  <span className="text-base">🎮</span>
                  <label
                    htmlFor="join-virtual"
                    className="text-xs sm:text-sm font-bold text-white cursor-pointer select-none"
                  >
                    Virtual Taekwondo (VR)
                  </label>
                </div>
                {virtualCount > 0 && (
                  <div className="flex items-center bg-[#1e2330] rounded-lg border border-slate-700/60 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={() => setJoiningVirtualDays(String(Math.max(1, virtualCount - 1)))}
                      className="w-7 h-7 flex items-center justify-center font-bold text-white hover:bg-slate-700/50 transition active:scale-95 cursor-pointer text-xs"
                    >
                      -
                    </button>
                    <span className="w-9 text-center text-xs font-bold text-white font-mono select-none">
                      {virtualCount}d
                    </span>
                    <button
                      type="button"
                      onClick={() => setJoiningVirtualDays(String(virtualCount + 1))}
                      className="w-7 h-7 flex items-center justify-center font-bold text-white hover:bg-slate-700/50 transition active:scale-95 cursor-pointer text-xs"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Accommodation Option */}
          <div className="space-y-2 pt-3 border-t border-line/50">
            <label className="block text-xs font-bold text-text uppercase tracking-wider">
              ACCOMMODATION OPTION <span className="text-gold">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setJoiningAccommodation('Yes')}
                className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  joiningAccommodation === 'Yes'
                    ? 'border-gold bg-gold/15 text-gold shadow-sm ring-1 ring-gold/40'
                    : 'border-line/60 bg-[#121620] text-text-dim hover:text-white hover:bg-[#151922]'
                }`}
              >
                🏨 Lodging Required
              </button>
              <button
                type="button"
                onClick={() => setJoiningAccommodation('No')}
                className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  joiningAccommodation === 'No'
                    ? 'border-gold bg-gold/15 text-gold shadow-sm ring-1 ring-gold/40'
                    : 'border-line/60 bg-[#121620] text-text-dim hover:text-white hover:bg-[#151922]'
                }`}
              >
                🚗 No Lodge (Daily Travel Pay)
              </button>
            </div>
            <p className="text-[10px] text-text-dim leading-relaxed">
              {joiningAccommodation === 'No'
                ? `If you choose NOT to stay in organizer lodging, you will be paid daily travel allowance according to fees scale.`
                : 'Requests organizer-provided lodging. Travel mileage allowance will be computed based on your actual distance bracket.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line/60 bg-[#151922] flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-text-dim hover:text-white font-bold text-xs hover:bg-white/5 border border-line transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="bg-gold hover:bg-yellow-400 text-ink px-5 py-2.5 rounded-xl font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            Confirm & Join Tournament
          </button>
        </div>
      </div>
    </div>
  );
};
