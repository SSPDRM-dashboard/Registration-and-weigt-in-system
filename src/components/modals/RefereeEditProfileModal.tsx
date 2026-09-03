import React from 'react';
import { User, X, Save } from 'lucide-react';
import { Referee } from '../../types';

interface RefereeEditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeReferee: Referee | null;
  refereeFullName: string;
  setRefereeFullName: (name: string) => void;
  refereeNric: string;
  refereePassword: string;
  setRefereePassword: (password: string) => void;
  refereePhone: string;
  setRefereePhone: (phone: string) => void;
  refereeClubName: string;
  setRefereeClubName: (club: string) => void;
  refereeResidential: string;
  setRefereeResidential: (residential: string) => void;
  refereeDistance: string | number;
  setRefereeDistance: (distance: string) => void;
  refereeBankName: string;
  setRefereeBankName: (bank: string) => void;
  refereeBankAccount: string;
  setRefereeBankAccount: (account: string) => void;
  refereeKyorugiStatus: 'IR' | 'NR' | 'SR' | 'TR';
  setRefereeKyorugiStatus: (status: 'IR' | 'NR' | 'SR' | 'TR') => void;
  refereePoomsaeStatus: 'IR' | 'NR' | 'SR' | 'TR';
  setRefereePoomsaeStatus: (status: 'IR' | 'NR' | 'SR' | 'TR') => void;
  refereeAccommodation: 'Yes' | 'No';
  setRefereeAccommodation: (acc: 'Yes' | 'No') => void;
  refereeCarPlate: string;
  setRefereeCarPlate: (plate: string) => void;
  refereeSpecialRole: 'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE';
  setRefereeSpecialRole: (role: 'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE') => void;
  referees: Referee[];
  refereeAccounts: Referee[];
  saveRefereeAccount: (ref: Referee) => Promise<void>;
  saveRefereeToFirestore: (ref: Referee) => Promise<void>;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

export const RefereeEditProfileModal: React.FC<RefereeEditProfileModalProps> = ({
  isOpen,
  onClose,
  activeReferee,
  refereeFullName,
  setRefereeFullName,
  refereeNric,
  refereePassword,
  setRefereePassword,
  refereePhone,
  setRefereePhone,
  refereeClubName,
  setRefereeClubName,
  refereeResidential,
  setRefereeResidential,
  refereeDistance,
  setRefereeDistance,
  refereeBankName,
  setRefereeBankName,
  refereeBankAccount,
  setRefereeBankAccount,
  refereeKyorugiStatus,
  setRefereeKyorugiStatus,
  refereePoomsaeStatus,
  setRefereePoomsaeStatus,
  refereeAccommodation,
  setRefereeAccommodation,
  refereeCarPlate,
  setRefereeCarPlate,
  refereeSpecialRole,
  setRefereeSpecialRole,
  referees,
  refereeAccounts,
  saveRefereeAccount,
  saveRefereeToFirestore,
  triggerMsg,
}) => {
  if (!isOpen || !activeReferee) return null;

  const handleSave = async () => {
    if (
      !refereeFullName ||
      !refereePhone ||
      !refereeClubName ||
      !refereeResidential ||
      refereeDistance.toString().trim() === '' ||
      !refereeBankName.trim() ||
      !refereeBankAccount.trim()
    ) {
      triggerMsg('Please fill in all required fields.', 'error');
      return;
    }

    const distVal = parseFloat(refereeDistance as string);
    if (isNaN(distVal) || distVal < 0) {
      triggerMsg('Please enter a valid number for Distance to Venue.', 'error');
      return;
    }

    const updatedRefInfo = {
      fullName: refereeFullName,
      password: refereePassword || undefined,
      phone: refereePhone,
      clubName: refereeClubName,
      residentialLocation: refereeResidential,
      distance: distVal,
      bankName: refereeBankName,
      bankAccount: refereeBankAccount,
      accommodation: refereeAccommodation,
      kyorugiStatus: refereeKyorugiStatus,
      poomsaeStatus: refereePoomsaeStatus,
      carPlate: refereeCarPlate,
      specialRole: refereeSpecialRole,
    };
    const cleanIc = activeReferee.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    try {
      const existingAcc = refereeAccounts.find(
        (a) => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc
      );
      if (existingAcc) {
        await saveRefereeAccount({
          ...existingAcc,
          ...updatedRefInfo,
        });
      }

      const matchingTournaments = referees.filter(
        (r) => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc
      );
      for (const tRef of matchingTournaments) {
        await saveRefereeToFirestore({
          ...tRef,
          ...updatedRefInfo,
        });
      }

      triggerMsg('Profile updated successfully!', 'ok');
      onClose();
    } catch (err) {
      console.error(err);
      triggerMsg('Failed to update profile', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
          <h2 className="text-xl font-bold text-text uppercase tracking-wider flex items-center gap-2">
            <User className="w-5 h-5 text-gold" />
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={refereeFullName}
                onChange={(e) => setRefereeFullName(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                NRIC Number (Cannot be changed)
              </label>
              <input
                type="text"
                value={refereeNric}
                disabled
                className="w-full bg-ink/50 border border-line text-sm rounded-xl py-2 px-3 text-text-dim cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Password
              </label>
              <input
                type="text"
                value={refereePassword}
                onChange={(e) => setRefereePassword(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={refereePhone}
                onChange={(e) => setRefereePhone(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                State / Club Name *
              </label>
              <input
                type="text"
                value={refereeClubName}
                onChange={(e) => setRefereeClubName(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Residential Location *
              </label>
              <input
                type="text"
                value={refereeResidential}
                onChange={(e) => setRefereeResidential(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Distance to Venue (Go & Return in KM) *
              </label>
              <input
                type="number"
                value={refereeDistance}
                onChange={(e) => setRefereeDistance(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Bank Name *
              </label>
              <input
                type="text"
                value={refereeBankName}
                onChange={(e) => setRefereeBankName(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Bank Account Number *
              </label>
              <input
                type="text"
                value={refereeBankAccount}
                onChange={(e) => setRefereeBankAccount(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Kyorugi Referee Status *
              </label>
              <select
                value={refereeKyorugiStatus}
                onChange={(e) => setRefereeKyorugiStatus(e.target.value as any)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
              >
                <option value="TR">Trainee Referee (TR)</option>
                <option value="SR">State Referee (SR)</option>
                <option value="NR">National Referee (NR)</option>
                <option value="IR">International Referee (IR)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Poomsae Referee Status *
              </label>
              <select
                value={refereePoomsaeStatus}
                onChange={(e) => setRefereePoomsaeStatus(e.target.value as any)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
              >
                <option value="TR">Trainee Referee (TR)</option>
                <option value="SR">State Referee (SR)</option>
                <option value="NR">National Referee (NR)</option>
                <option value="IR">International Referee (IR)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Accommodation Required? *
              </label>
              <select
                value={refereeAccommodation}
                onChange={(e) => setRefereeAccommodation(e.target.value as any)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
              >
                <option value="No">No - I will arrange my own</option>
                <option value="Yes">Yes - Organizer to arrange</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Car Plate Number
              </label>
              <input
                type="text"
                value={refereeCarPlate}
                onChange={(e) => setRefereeCarPlate(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
                Special Appointed Role
              </label>
              <select
                value={refereeSpecialRole}
                onChange={(e) => setRefereeSpecialRole(e.target.value as any)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
              >
                <option value="None">None (Standard Referee)</option>
                <option value="TD">Technical Delegate (TD)</option>
                <option value="CSB">Supervisory Board (CSB)</option>
                <option value="RIC">Referee In-Charge (RIC)</option>
                <option value="GAME_MASTER">Game Master (GM) - Virtual Taekwondo</option>
                <option value="TECHNICAL_OPERATOR">Technical Operator (TO) - Virtual Taekwondo</option>
                <option value="VIRTUAL_REFEREE">Virtual Referee (VR) - Virtual Taekwondo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-line bg-surface-2 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-text font-bold text-sm hover:bg-surface border border-line transition cursor-pointer"
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
