import React from 'react';
import { MapPin, X, Save } from 'lucide-react';
import { Referee } from '../../types';
import { RefereeFeesConfig } from '../../utils';

interface RefereeAccommodationModalProps {
  editingAccReferee: Referee | null;
  onClose: () => void;
  editAccStatus: 'Yes' | 'No';
  setEditAccStatus: (status: 'Yes' | 'No') => void;
  editAccHotelDays: string;
  setEditAccHotelDays: (days: string) => void;
  editAccCheckoutDate: string;
  setEditAccCheckoutDate: (date: string) => void;
  editAccDetails: string;
  setEditAccDetails: (details: string) => void;
  editAccMapsLink: string;
  setEditAccMapsLink: (link: string) => void;
  refereeFees: RefereeFeesConfig;
  refereeAccounts: Referee[];
  saveRefereeToFirestore: (ref: Referee) => Promise<void>;
  saveRefereeAccount: (ref: Referee) => Promise<void>;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
}

export const RefereeAccommodationModal: React.FC<RefereeAccommodationModalProps> = ({
  editingAccReferee,
  onClose,
  editAccStatus,
  setEditAccStatus,
  editAccHotelDays,
  setEditAccHotelDays,
  editAccCheckoutDate,
  setEditAccCheckoutDate,
  editAccDetails,
  setEditAccDetails,
  editAccMapsLink,
  setEditAccMapsLink,
  refereeFees,
  refereeAccounts,
  saveRefereeToFirestore,
  saveRefereeAccount,
  triggerMsg,
}) => {
  if (!editingAccReferee) return null;

  const handleSave = async () => {
    try {
      const parsedHotelDays = editAccHotelDays.trim() !== '' ? Number(editAccHotelDays) : undefined;
      const parsedCheckout = editAccCheckoutDate.trim() || undefined;
      const updatedReferee: Referee = {
        ...editingAccReferee,
        accommodation: editAccStatus,
        accommodationDetails: editAccDetails.trim(),
        accommodationMapsLink: editAccMapsLink.trim(),
        hotelDaysProvided: parsedHotelDays,
        hotelCheckoutDate: parsedCheckout,
      };
      await saveRefereeToFirestore(updatedReferee);

      const cleanIc = editingAccReferee.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const existingAcc = refereeAccounts.find(
        (a) => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc
      );
      if (existingAcc) {
        await saveRefereeAccount({
          ...existingAcc,
          accommodation: editAccStatus,
          accommodationDetails: editAccDetails.trim(),
          accommodationMapsLink: editAccMapsLink.trim(),
          hotelDaysProvided: parsedHotelDays,
          hotelCheckoutDate: parsedCheckout,
        });
      }

      triggerMsg('Accommodation details updated successfully!', 'ok');
      onClose();
    } catch (err) {
      console.error('Failed to update accommodation details:', err);
      triggerMsg('Failed to save changes.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
          <h2 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gold" />
            Accommodation Settings
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-bold text-text-dim">REFEREE NAME</p>
            <p className="text-sm font-semibold text-text">{editingAccReferee.fullName}</p>
            <p className="text-[10px] text-text-dim font-mono">{editingAccReferee.nric}</p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">
              Lodging Status / Preference
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditAccStatus('Yes')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  editAccStatus === 'Yes'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-sm'
                    : 'bg-ink border-line text-text-dim hover:text-text'
                }`}
              >
                🏨 Lodging Required ('Yes')
              </button>
              <button
                type="button"
                onClick={() => setEditAccStatus('No')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  editAccStatus === 'No'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-sm'
                    : 'bg-ink border-line text-text-dim hover:text-text'
                }`}
              >
                🏠 No Lodge / Self-Arranged ('No')
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">
                Hotel Provided (Days)
              </label>
              <input
                type="number"
                min="0"
                value={editAccHotelDays}
                onChange={(e) => setEditAccHotelDays(e.target.value)}
                placeholder={
                  refereeFees.default_hotel_days_provided !== undefined
                    ? `Default: ${refereeFees.default_hotel_days_provided}`
                    : 'e.g. 2'
                }
                className="w-full bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
              <p className="text-[9px] text-text-dim">Number of days hotel is provided.</p>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">
                Check-Out Date / Day
              </label>
              <input
                type="text"
                value={editAccCheckoutDate}
                onChange={(e) => setEditAccCheckoutDate(e.target.value)}
                placeholder={
                  refereeFees.default_hotel_checkout_date
                    ? `Default: ${refereeFees.default_hotel_checkout_date}`
                    : 'e.g. 15 Oct (12:00 PM)'
                }
                className="w-full bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
              />
              <p className="text-[9px] text-text-dim">Day/time referee needs to check out.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">
              Accommodation Details (Override)
            </label>
            <textarea
              rows={3}
              value={editAccDetails}
              onChange={(e) => setEditAccDetails(e.target.value)}
              placeholder="e.g. Hotel Grand Chancellor, Room 402. Check-in on 12th Oct 2 PM."
              className="w-full bg-ink border border-line text-xs rounded-xl p-3 text-text focus:outline-none focus:border-gold resize-none"
            />
            <p className="text-[10px] text-text-dim">Leave blank to use default global lodging details.</p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">
              Google Maps Link
            </label>
            <input
              type="url"
              value={editAccMapsLink}
              onChange={(e) => setEditAccMapsLink(e.target.value)}
              placeholder="https://maps.app.goo.gl/... or https://google.com/maps/..."
              className="w-full bg-ink border border-line text-xs rounded-xl py-2.5 px-3 text-text focus:outline-none focus:border-gold"
            />
            <p className="text-[10px] text-text-dim">Paste the Google Maps link so the referee can easily locate the hotel.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-2/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-text-dim hover:text-text font-bold text-xs hover:bg-surface border border-line transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-gold hover:bg-yellow-400 text-ink px-4 py-2 rounded-xl font-bold text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Accommodation
          </button>
        </div>
      </div>
    </div>
  );
};
