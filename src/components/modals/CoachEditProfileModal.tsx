import React from 'react';
import { User, X, Save } from 'lucide-react';
import { Coach } from '../../types';

interface CoachEditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: string | null;
  coachEditName: string;
  setCoachEditName: (name: string) => void;
  coachEditClub: string;
  setCoachEditClub: (club: string) => void;
  coachEditPhone: string;
  setCoachEditPhone: (phone: string) => void;
  coachEditEmail: string;
  setCoachEditEmail: (email: string) => void;
  coachEditPassword: string;
  setCoachEditPassword: (password: string) => void;
  coaches: Record<string, Coach>;
  saveCoachesToStorage: (coaches: Record<string, Coach>) => void;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

export const CoachEditProfileModal: React.FC<CoachEditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  coachEditName,
  setCoachEditName,
  coachEditClub,
  setCoachEditClub,
  coachEditPhone,
  setCoachEditPhone,
  coachEditEmail,
  setCoachEditEmail,
  coachEditPassword,
  setCoachEditPassword,
  coaches,
  saveCoachesToStorage,
  triggerMsg,
}) => {
  if (!isOpen) return null;

  const handleSave = () => {
    if (!coachEditName.trim() || !coachEditClub.trim() || !coachEditPassword.trim()) {
      triggerMsg('Name, Club, and Password are required.', 'error');
      return;
    }
    const updated = {
      ...coaches,
      [user || '']: {
        ...coaches[user || ''],
        name: coachEditName.trim(),
        club: coachEditClub.trim(),
        phone: coachEditPhone.trim() || undefined,
        email: coachEditEmail.trim() || undefined,
        password: coachEditPassword.trim(),
      },
    };
    saveCoachesToStorage(updated);
    onClose();
    triggerMsg('Coach profile updated successfully!', 'ok');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
          <h2 className="text-xl font-bold text-text uppercase tracking-wider flex items-center gap-2">
            <User className="w-5 h-5 text-gold" />
            Edit Coach Profile
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text transition p-2 hover:bg-surface border border-transparent hover:border-line rounded-full cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="col-span-full">
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Username (Cannot be changed)
              </label>
              <input
                type="text"
                value={user || ''}
                disabled
                className="w-full bg-ink/50 border border-line text-sm rounded-xl py-2 px-3 text-text-dim cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Coach Name *
              </label>
              <input
                type="text"
                value={coachEditName}
                onChange={(e) => setCoachEditName(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Club Name *
              </label>
              <input
                type="text"
                value={coachEditClub}
                onChange={(e) => setCoachEditClub(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={coachEditPhone}
                onChange={(e) => setCoachEditPhone(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={coachEditEmail}
                onChange={(e) => setCoachEditEmail(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div className="col-span-full">
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Access Password * (Edit to change)
              </label>
              <input
                type="text"
                value={coachEditPassword}
                onChange={(e) => setCoachEditPassword(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-line bg-surface-2 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-text-dim border border-line hover:text-text transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-gold hover:bg-yellow-400 text-ink px-6 py-2.5 rounded-xl font-bold text-sm transition shadow flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
