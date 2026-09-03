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
  saveCompsToStorage: (comps: Competition[]) => Promise<void>;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

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
  saveCompsToStorage,
  triggerMsg,
}) => {
  if (!isOpen) return null;

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
