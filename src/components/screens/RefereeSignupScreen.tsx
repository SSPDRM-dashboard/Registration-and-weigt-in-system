import React from 'react';
import { Scale } from 'lucide-react';

interface RefereeSignupScreenProps {
  handlePhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingPhoto: string | null;
  refereeFullName: string;
  setRefereeFullName: (val: string) => void;
  refereeNric: string;
  setRefereeNric: (val: string) => void;
  refereePassword: string;
  setRefereePassword: (val: string) => void;
  refereePhone: string;
  setRefereePhone: (val: string) => void;
  refereeClubName: string;
  setRefereeClubName: (val: string) => void;
  refereeResidential: string;
  setRefereeResidential: (val: string) => void;
  refereeDistance: string | number;
  setRefereeDistance: (val: string) => void;
  refereeBankName: string;
  setRefereeBankName: (val: string) => void;
  refereeBankAccount: string;
  setRefereeBankAccount: (val: string) => void;
  refereeKyorugiStatus: 'IR' | 'NR' | 'SR' | 'TR';
  setRefereeKyorugiStatus: (val: 'IR' | 'NR' | 'SR' | 'TR') => void;
  refereePoomsaeStatus: 'IR' | 'NR' | 'SR' | 'TR';
  setRefereePoomsaeStatus: (val: 'IR' | 'NR' | 'SR' | 'TR') => void;
  refereeAccommodation: 'Yes' | 'No';
  setRefereeAccommodation: (val: 'Yes' | 'No') => void;
  refereeCarPlate: string;
  setRefereeCarPlate: (val: string) => void;
  refereeSpecialRole: 'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE';
  setRefereeSpecialRole: (val: 'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE') => void;
  refereeConsent: boolean;
  setRefereeConsent: (val: boolean) => void;
  handleRefereeRegister: () => void | Promise<void>;
  setScreen: (screen: any) => void;
}

export const RefereeSignupScreen: React.FC<RefereeSignupScreenProps> = ({
  handlePhotoSelect,
  pendingPhoto,
  refereeFullName,
  setRefereeFullName,
  refereeNric,
  setRefereeNric,
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
  refereeConsent,
  setRefereeConsent,
  handleRefereeRegister,
  setScreen,
}) => {
  return (
    <div className="max-w-3xl mx-auto my-8 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden transition-all duration-300">
      <div className="p-6 bg-gradient-to-b from-surface-2/50 to-transparent border-b border-line text-center">
        <Scale className="w-10 h-10 text-gold mx-auto mb-2 animate-pulse" />
        <h2 className="text-xl font-bold uppercase tracking-wider text-text font-sans">Referee Registration</h2>
        <p className="text-xs text-text-dim mt-1">Register your global referee officiating profile</p>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Referee Photograph */}
          <div className="md:col-span-2 bg-ink/30 p-4 rounded-xl border border-line">
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
              Referee Portrait Photograph (4:5 ratio) *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="w-full text-xs text-text-dim bg-ink border border-line file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-surface-2 file:text-gold hover:file:opacity-90 transition cursor-pointer"
            />
            {pendingPhoto && (
              <div className="mt-4 flex items-center space-x-3">
                <img
                  src={pendingPhoto}
                  alt="Crop preview"
                  className="w-20 h-24 object-cover rounded-lg border border-line"
                />
                <span className="text-xs text-text-dim">
                  Portrait automatically optimized and cropped (192 x 240 pixels) for your referee pass.
                </span>
              </div>
            )}
          </div>

          {/* Personal Information */}
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
              Full Name (as per NRIC) *
            </label>
            <input
              type="text"
              value={refereeFullName}
              onChange={(e) => setRefereeFullName(e.target.value)}
              placeholder="e.g. TAN KIAN MENG"
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
              NRIC Number *
            </label>
            <input
              type="text"
              value={refereeNric}
              onChange={(e) => setRefereeNric(e.target.value)}
              placeholder="e.g. 850101-14-5555"
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
              Password *
            </label>
            <input
              type="password"
              value={refereePassword}
              onChange={(e) => setRefereePassword(e.target.value)}
              placeholder="At least 6 characters"
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
              placeholder="e.g. 012-3456789"
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
              placeholder="e.g. PERAK TKD CLUB"
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
            />
          </div>

          {/* Logistics */}
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
              Residential Location *
            </label>
            <input
              type="text"
              value={refereeResidential}
              onChange={(e) => setRefereeResidential(e.target.value)}
              placeholder="e.g. Ipoh, Perak"
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
              placeholder="e.g. 120"
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
            />
            <p className="text-[10px] text-text-dim/80 mt-1">
              Total combined distance (return trip) base on Google Maps/Waze.
            </p>
          </div>

          {/* Bank details */}
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
              Bank Name *
            </label>
            <input
              type="text"
              value={refereeBankName}
              onChange={(e) => setRefereeBankName(e.target.value)}
              placeholder="e.g. Maybank"
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
              placeholder="e.g. 164012345678"
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
            />
          </div>

          {/* Statuses */}
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
              placeholder="e.g. WQY 1234"
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold uppercase"
            />
            <p className="text-[10px] text-text-dim/80 mt-1">Required to reserve car park space for referees.</p>
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

        {/* PDPA Consent Statement */}
        <div className="bg-surface-2 p-4 rounded-xl border border-line text-xs text-text-dim space-y-3">
          <p className="font-semibold text-gold uppercase tracking-wider text-[10px]">
            PDPA Personal Data Consent Statement
          </p>
          <p className="leading-relaxed text-[11px]">
            I agree to the collection, processing and use of my personal data for the purpose of tournament
            registration, scheduling, officiating roles coordination, bank-in transactions, and
            accommodation/logistic arrangements, in accordance with the Personal Data Protection Act (PDPA).
          </p>
          <label className="flex items-start space-x-3 text-text cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={refereeConsent}
              onChange={(e) => setRefereeConsent(e.target.checked)}
              className="mt-0.5 rounded border-line text-gold focus:ring-gold bg-ink w-4 h-4 cursor-pointer"
            />
            <span className="font-semibold text-xs select-none">
              I agree to the collection, processing and use of my personal data *
            </span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setScreen('login')}
            className="flex-1 border border-line text-text font-bold py-2.5 rounded-xl text-sm transition hover:bg-surface-2 cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            onClick={handleRefereeRegister}
            className="flex-1 bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition cursor-pointer shadow-md"
          >
            Submit Registration
          </button>
        </div>
      </div>
    </div>
  );
};
