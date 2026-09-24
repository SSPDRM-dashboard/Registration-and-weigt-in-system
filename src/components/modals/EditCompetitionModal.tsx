import React from 'react';
import { Edit, X } from 'lucide-react';
import { Competition } from '../../types';
import { CurrencySelector } from '../CurrencySelector';

interface EditCompetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  compId: string | null;
  competitions: Competition[];
  editCompName: string;
  setEditCompName: (name: string) => void;
  editCompVenue: string;
  setEditCompVenue: (venue: string) => void;
  editCompDate: string;
  setEditCompDate: (date: string) => void;
  editCompEndDate: string;
  setEditCompEndDate: (date: string) => void;
  editCompRegistrationCloseDate: string;
  setEditCompRegistrationCloseDate: (date: string) => void;
  editCompPasscode: string;
  setEditCompPasscode: (code: string) => void;
  editCompCurrency: string;
  setEditCompCurrency: (currency: string) => void;
  editCompEvents?: string[];
  setEditCompEvents?: (events: string[]) => void;
  editCompFeeModel?: 'STANDARD' | 'SPECIAL_PACKAGE';
  setEditCompFeeModel?: (model: 'STANDARD' | 'SPECIAL_PACKAGE') => void;
  editCompPkgFirst?: string;
  setEditCompPkgFirst?: (fee: string) => void;
  editCompPkgSecond?: string;
  setEditCompPkgSecond?: (fee: string) => void;
  editCompPkgSub?: string;
  setEditCompPkgSub?: (fee: string) => void;
  editCompPkgFive?: string;
  setEditCompPkgFive?: (fee: string) => void;
  saveCompsToStorage: (comps: Competition[]) => Promise<void>;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

export const STANDARD_EVENTS = [
  'Kyorugi',
  'Para Kyorugi',
  'Recognize Poomsae',
  'Free Style Poomsae',
  'Para Poomsae',
  'Virtual Taekwondo',
  'Kyukpa',
  'Speed Kicking',
  'Skipping Rope',
];

export const EditCompetitionModal: React.FC<EditCompetitionModalProps> = ({
  isOpen,
  onClose,
  compId,
  competitions,
  editCompName,
  setEditCompName,
  editCompVenue,
  setEditCompVenue,
  editCompDate,
  setEditCompDate,
  editCompEndDate,
  setEditCompEndDate,
  editCompRegistrationCloseDate,
  setEditCompRegistrationCloseDate,
  editCompPasscode,
  setEditCompPasscode,
  editCompCurrency,
  setEditCompCurrency,
  editCompEvents = [],
  setEditCompEvents,
  editCompFeeModel = 'STANDARD',
  setEditCompFeeModel,
  editCompPkgFirst = '80',
  setEditCompPkgFirst,
  editCompPkgSecond = '40',
  setEditCompPkgSecond,
  editCompPkgSub = '20',
  setEditCompPkgSub,
  editCompPkgFive = '150',
  setEditCompPkgFive,
  saveCompsToStorage,
  triggerMsg,
}) => {
  if (!isOpen) return null;

  const handleApplyPreset = () => {
    if (setEditCompFeeModel) setEditCompFeeModel('SPECIAL_PACKAGE');
    if (setEditCompPkgFirst) setEditCompPkgFirst('80');
    if (setEditCompPkgSecond) setEditCompPkgSecond('40');
    if (setEditCompPkgSub) setEditCompPkgSub('20');
    if (setEditCompPkgFive) setEditCompPkgFive('150');
    triggerMsg('Loaded Special SGD Package ($80 / $40 / $20 / $150).', 'ok');
  };

  const handleToggleEvent = (ev: string) => {
    if (!setEditCompEvents) return;
    if (editCompEvents.includes(ev)) {
      if (editCompEvents.length <= 1) {
        triggerMsg('A tournament must have at least one event.', 'error');
        return;
      }
      setEditCompEvents(editCompEvents.filter((e) => e !== ev));
    } else {
      setEditCompEvents([...editCompEvents, ev]);
    }
  };

  const handleSelectAllStandard = () => {
    if (!setEditCompEvents) return;
    const combined = Array.from(new Set([...editCompEvents, ...STANDARD_EVENTS]));
    setEditCompEvents(combined);
  };

  const handleSave = async () => {
    if (
      !editCompName.trim() ||
      !editCompVenue.trim() ||
      !editCompDate.trim() ||
      !editCompEndDate.trim() ||
      !editCompPasscode.trim()
    ) {
      triggerMsg('Please fill in all required fields.', 'error');
      return;
    }
    const updated = competitions.map((c) =>
      c.id === compId
        ? {
            ...c,
            name: editCompName.trim(),
            venue: editCompVenue.trim(),
            date: editCompDate,
            endDate: editCompEndDate,
            registrationCloseDate: editCompRegistrationCloseDate || undefined,
            staffCode: editCompPasscode.trim(),
            currency: editCompCurrency.trim() || 'RM',
            events: editCompEvents && editCompEvents.length > 0 ? editCompEvents : c.events,
            feeModel: editCompFeeModel,
            packageFirstEventFee: editCompPkgFirst ? String(editCompPkgFirst).trim() : c.packageFirstEventFee,
            packageSecondEventFee: editCompPkgSecond ? String(editCompPkgSecond).trim() : c.packageSecondEventFee,
            packageSubsequentEventFee: editCompPkgSub ? String(editCompPkgSub).trim() : c.packageSubsequentEventFee,
            packageFiveEventFee: editCompPkgFive ? String(editCompPkgFive).trim() : c.packageFiveEventFee,
          }
        : c
    );
    await saveCompsToStorage(updated);
    onClose();
    triggerMsg('Tournament updated successfully.', 'ok');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
          <h2 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-2">
            <Edit className="w-5 h-5 text-gold" />
            Edit Tournament Details
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
              Championship Title *
            </label>
            <input
              type="text"
              value={editCompName}
              onChange={(e) => setEditCompName(e.target.value)}
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
              Venue *
            </label>
            <input
              type="text"
              value={editCompVenue}
              onChange={(e) => setEditCompVenue(e.target.value)}
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={editCompDate}
                onChange={(e) => setEditCompDate(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={editCompEndDate}
                onChange={(e) => setEditCompEndDate(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
              Registration Closing Date (Optional)
            </label>
            <input
              type="date"
              value={editCompRegistrationCloseDate}
              onChange={(e) => setEditCompRegistrationCloseDate(e.target.value)}
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CurrencySelector
              value={editCompCurrency}
              onChange={setEditCompCurrency}
              label="Tournament Currency"
            />

            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Weigh-In Staff Passcode *
              </label>
              <input
                type="text"
                value={editCompPasscode}
                onChange={(e) => setEditCompPasscode(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold font-mono"
              />
            </div>
          </div>

          {/* Tournament Events Selection */}
          <div className="bg-ink/40 border border-line rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider">
                  Tournament Events ({editCompEvents.length})
                </label>
                <p className="text-[11px] text-text-dim">
                  Select which events are active for this tournament (including Kyukpa, Speed Kicking, etc.)
                </p>
              </div>
              <button
                type="button"
                onClick={handleSelectAllStandard}
                className="text-[10px] text-gold hover:text-gold/80 border border-gold/30 hover:border-gold/60 px-2.5 py-1 rounded-lg transition"
              >
                + Include All Standard
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {Array.from(new Set([...STANDARD_EVENTS, ...editCompEvents])).map((ev) => {
                const isSelected = editCompEvents.includes(ev);
                return (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => handleToggleEvent(ev)}
                    className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-gold/10 border-gold text-gold font-bold shadow-sm'
                        : 'bg-surface border-line text-text-dim hover:border-line-hover hover:text-text'
                    }`}
                  >
                    <span className="truncate mr-1">{ev}</span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                        isSelected ? 'bg-gold text-ink font-black' : 'border border-line'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Competition Package Fees */}
          <div className="bg-ink/40 border border-line rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider">
                  Competition Fee Model
                </label>
                <p className="text-[11px] text-text-dim">
                  Choose standard per-event fees or special tiered package pricing.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={editCompFeeModel}
                  onChange={(e) => setEditCompFeeModel && setEditCompFeeModel(e.target.value as 'STANDARD' | 'SPECIAL_PACKAGE')}
                  className="bg-ink border border-line rounded-xl px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-gold font-medium w-full sm:w-auto"
                >
                  <option value="STANDARD">Standard Per-Event</option>
                  <option value="SPECIAL_PACKAGE">Special Package Tiers</option>
                </select>
                {editCompFeeModel === 'SPECIAL_PACKAGE' && (
                  <button
                    type="button"
                    onClick={handleApplyPreset}
                    className="text-[10px] text-gold hover:text-gold/80 border border-gold/30 hover:border-gold/60 px-2 py-1 rounded-lg transition shrink-0 whitespace-nowrap"
                    title="Load $80 / $40 / $20 / $150 SGD package rates"
                  >
                    Preset ($80/$40/$20/$150)
                  </button>
                )}
              </div>
            </div>

            {editCompFeeModel === 'SPECIAL_PACKAGE' && (
              <div className="mt-3 p-3 bg-surface/80 border border-line rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gold uppercase tracking-wider">Special Package Tier Rates ({editCompCurrency})</span>
                  <span className="text-[10px] text-text-dim">Applied automatically to multi-event entrants</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">
                      1st Event ({editCompCurrency})
                    </label>
                    <input
                      type="text"
                      value={editCompPkgFirst}
                      onChange={(e) => setEditCompPkgFirst && setEditCompPkgFirst(e.target.value)}
                      placeholder="e.g. 80"
                      className="w-full bg-ink border border-line rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none focus:border-gold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">
                      2nd Event ({editCompCurrency})
                    </label>
                    <input
                      type="text"
                      value={editCompPkgSecond}
                      onChange={(e) => setEditCompPkgSecond && setEditCompPkgSecond(e.target.value)}
                      placeholder="e.g. 40"
                      className="w-full bg-ink border border-line rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none focus:border-gold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">
                      Subsequent ({editCompCurrency})
                    </label>
                    <input
                      type="text"
                      value={editCompPkgSub}
                      onChange={(e) => setEditCompPkgSub && setEditCompPkgSub(e.target.value)}
                      placeholder="e.g. 20"
                      title="Subsequent events including Kyukpa, Speed Kicking, Rope Skipping"
                      className="w-full bg-ink border border-line rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none focus:border-gold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">
                      5 Events Bundle ({editCompCurrency})
                    </label>
                    <input
                      type="text"
                      value={editCompPkgFive}
                      onChange={(e) => setEditCompPkgFive && setEditCompPkgFive(e.target.value)}
                      placeholder="e.g. 150"
                      className="w-full bg-ink border border-line rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none focus:border-gold font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-text-dim italic">
                  Subsequent events ($20 {editCompCurrency}) apply to additional registrations including Kyukpa, Speed Kicking, and Skipping Rope. Athletes joining all 5 events receive the bundled $150 {editCompCurrency} rate.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-line bg-surface-2/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-text-dim hover:text-text font-bold text-xs hover:bg-surface border border-line transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-gold hover:bg-yellow-400 text-ink font-bold text-xs transition cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
