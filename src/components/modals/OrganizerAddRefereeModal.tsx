import React from 'react';
import { User, X, Search, Check, Plus } from 'lucide-react';
import { Referee } from '../../types';

interface OrganizerAddRefereeModalProps {
  isOpen: boolean;
  onClose: () => void;
  addRefereeModalTab: 'existing' | 'new';
  setAddRefereeModalTab: (tab: 'existing' | 'new') => void;
  searchRegisteredQuery: string;
  setSearchRegisteredQuery: (query: string) => void;
  refereeAccounts: Referee[];
  referees: Referee[];
  selectedExistingRefereeNrics: string[];
  setSelectedExistingRefereeNrics: React.Dispatch<React.SetStateAction<string[]>>;
  refereeSpecialRole: 'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE';
  setRefereeSpecialRole: (role: 'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE') => void;
  refereeFullName: string;
  setRefereeFullName: (name: string) => void;
  refereeNric: string;
  setRefereeNric: (nric: string) => void;
  refereePhone: string;
  setRefereePhone: (phone: string) => void;
  refereeClubName: string;
  setRefereeClubName: (club: string) => void;
  refereeResidential: string;
  setRefereeResidential: (res: string) => void;
  refereeDistance: string | number;
  setRefereeDistance: (dist: string) => void;
  refereeBankName: string;
  setRefereeBankName: (bank: string) => void;
  refereeBankAccount: string;
  setRefereeBankAccount: (acc: string) => void;
  refereeKyorugiStatus: 'IR' | 'NR' | 'SR' | 'TR';
  setRefereeKyorugiStatus: (status: 'IR' | 'NR' | 'SR' | 'TR') => void;
  refereePoomsaeStatus: 'IR' | 'NR' | 'SR' | 'TR';
  setRefereePoomsaeStatus: (status: 'IR' | 'NR' | 'SR' | 'TR') => void;
  refereeAccommodation: 'Yes' | 'No';
  setRefereeAccommodation: (acc: 'Yes' | 'No') => void;
  refereeCarPlate: string;
  setRefereeCarPlate: (plate: string) => void;
  handleOrganizerAddExistingReferee: () => Promise<void>;
  handleOrganizerSaveNewReferee: () => Promise<void>;
}

export const OrganizerAddRefereeModal: React.FC<OrganizerAddRefereeModalProps> = ({
  isOpen,
  onClose,
  addRefereeModalTab,
  setAddRefereeModalTab,
  searchRegisteredQuery,
  setSearchRegisteredQuery,
  refereeAccounts,
  referees,
  selectedExistingRefereeNrics,
  setSelectedExistingRefereeNrics,
  refereeSpecialRole,
  setRefereeSpecialRole,
  refereeFullName,
  setRefereeFullName,
  refereeNric,
  setRefereeNric,
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
  handleOrganizerAddExistingReferee,
  handleOrganizerSaveNewReferee,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
          <h2 className="text-xl font-bold text-text uppercase tracking-wider flex items-center gap-2">
            <User className="w-5 h-5 text-gold" />
            Add Referee to Tournament
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line bg-surface-2/20">
          <button
            type="button"
            onClick={() => setAddRefereeModalTab('existing')}
            className={`flex-1 py-3 px-4 text-center text-sm font-semibold border-b-2 transition cursor-pointer ${
              addRefereeModalTab === 'existing'
                ? 'border-gold text-gold bg-gold/5'
                : 'border-transparent text-text-dim hover:text-text hover:bg-surface-2/10'
            }`}
          >
            Select Registered Referee
          </button>
          <button
            type="button"
            onClick={() => setAddRefereeModalTab('new')}
            className={`flex-1 py-3 px-4 text-center text-sm font-semibold border-b-2 transition cursor-pointer ${
              addRefereeModalTab === 'new'
                ? 'border-gold text-gold bg-gold/5'
                : 'border-transparent text-text-dim hover:text-text hover:bg-surface-2/10'
            }`}
          >
            Create New Referee Profile
          </button>
        </div>

        {/* Content */}
        {addRefereeModalTab === 'existing' ? (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 flex flex-col min-h-0">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                <input
                  type="text"
                  placeholder="Search registered referees by name, NRIC, or club..."
                  value={searchRegisteredQuery}
                  onChange={(e) => setSearchRegisteredQuery(e.target.value)}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2.5 pl-10 pr-4 text-text focus:outline-none focus:border-gold placeholder:text-text-dim/60"
                />
              </div>

              <div className="border border-line rounded-2xl overflow-hidden bg-ink/30 flex flex-col max-h-[220px]">
                <div className="p-3 bg-surface border-b border-line text-[10px] font-bold uppercase tracking-wider text-text-dim flex justify-between items-center shrink-0">
                  <span>Name & NRIC</span>
                  <span>Club & Qualifications</span>
                </div>
                <div className="overflow-y-auto divide-y divide-line flex-1">
                  {(() => {
                    const availableRegisteredReferees = refereeAccounts.filter((acc) => {
                      const cleanAccNric = acc.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                      const isAlreadyInComp = referees.some(
                        (r) => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanAccNric
                      );
                      if (isAlreadyInComp) return false;

                      if (searchRegisteredQuery.trim()) {
                        const q = searchRegisteredQuery.toLowerCase();
                        return (
                          acc.fullName.toLowerCase().includes(q) ||
                          acc.nric.toLowerCase().includes(q) ||
                          (acc.clubName && acc.clubName.toLowerCase().includes(q))
                        );
                      }
                      return true;
                    });
                    if (availableRegisteredReferees.length === 0) {
                      return (
                        <div className="p-8 text-center text-sm text-text-dim">
                          No registered referees found matching your search.
                        </div>
                      );
                    }
                    const allAvailableSelected =
                      availableRegisteredReferees.length > 0 &&
                      availableRegisteredReferees.every((acc) => selectedExistingRefereeNrics.includes(acc.nric));
                    return (
                      <>
                        <div className="p-2.5 bg-surface-2/30 border-b border-line flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (allAvailableSelected) {
                                setSelectedExistingRefereeNrics([]);
                              } else {
                                setSelectedExistingRefereeNrics(availableRegisteredReferees.map((a) => a.nric));
                              }
                            }}
                            className="text-gold hover:underline font-bold text-xs flex items-center gap-2 cursor-pointer"
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                allAvailableSelected ? 'border-gold bg-gold text-ink' : 'border-line bg-surface'
                              }`}
                            >
                              {allAvailableSelected && <Check className="w-3 h-3 font-bold" />}
                            </div>
                            {allAvailableSelected ? 'Deselect All' : `Select All (${availableRegisteredReferees.length})`}
                          </button>
                          {selectedExistingRefereeNrics.length > 0 && (
                            <span className="text-text-dim font-medium">
                              {selectedExistingRefereeNrics.length} referee(s) selected
                            </span>
                          )}
                        </div>
                        {availableRegisteredReferees.map((acc) => {
                          const isSelected = selectedExistingRefereeNrics.includes(acc.nric);
                          return (
                            <button
                              key={acc.nric}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedExistingRefereeNrics((prev) => prev.filter((n) => n !== acc.nric));
                                } else {
                                  setSelectedExistingRefereeNrics((prev) => [...prev, acc.nric]);
                                  if (acc.specialRole) setRefereeSpecialRole(acc.specialRole);
                                }
                              }}
                              className={`w-full text-left p-3.5 flex items-center justify-between text-sm transition cursor-pointer ${
                                isSelected
                                  ? 'bg-gold/10 hover:bg-gold/15 border-l-4 border-gold'
                                  : 'hover:bg-surface-2/40 border-l-4 border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                                    isSelected ? 'border-gold bg-gold text-ink' : 'border-line'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 font-bold" />}
                                </div>
                                <div>
                                  <div className="font-bold text-text text-sm">{acc.fullName}</div>
                                  <div className="text-xs text-text-dim font-mono">{acc.nric}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-semibold text-text">{acc.clubName || 'N/A'}</div>
                                <div className="flex gap-1.5 mt-1 justify-end">
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface border border-line text-text-dim">
                                    Kyorugi: {acc.kyorugiStatus}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface border border-line text-text-dim">
                                    Poomsae: {acc.poomsaeStatus}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {selectedExistingRefereeNrics.length === 1 && (() => {
              const singleNric = selectedExistingRefereeNrics[0];
              const acc = refereeAccounts.find((a) => a.nric === singleNric);
              if (!acc) return null;
              return (
                <div className="border border-line rounded-2xl p-5 bg-surface-2/20 space-y-4 animate-fade-in text-sm">
                  <h4 className="text-xs font-bold text-gold uppercase tracking-wider">
                    Referee Selection Profile Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                    <div>
                      <span className="text-text-dim uppercase tracking-wider block mb-0.5">Phone</span>
                      <span className="font-semibold text-text">{acc.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-text-dim uppercase tracking-wider block mb-0.5">Residential Location</span>
                      <span className="font-semibold text-text">{acc.residentialLocation || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-text-dim uppercase tracking-wider block mb-0.5">Distance to Venue</span>
                      <span className="font-semibold text-text">
                        {acc.distance !== undefined ? `${acc.distance} KM` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-dim uppercase tracking-wider block mb-0.5">Bank Information</span>
                      <span className="font-semibold text-text">
                        {acc.bankName ? `${acc.bankName} - ${acc.bankAccount || 'No Acct'}` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-dim uppercase tracking-wider block mb-0.5">Car Plate</span>
                      <span className="font-semibold text-text uppercase">{acc.carPlate || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-text-dim uppercase tracking-wider block mb-0.5">Accommodation Preference</span>
                      <span className="font-semibold text-text">{acc.accommodation || 'No'}</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-line/60">
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
                      Assign Special Appointed Role for This Tournament
                    </label>
                    <select
                      value={refereeSpecialRole}
                      onChange={(e) => setRefereeSpecialRole(e.target.value as any)}
                      className="w-full sm:max-w-xs bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
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
              );
            })()}

            {selectedExistingRefereeNrics.length > 1 && (() => {
              const selectedAccs = refereeAccounts.filter((a) => selectedExistingRefereeNrics.includes(a.nric));
              return (
                <div className="border border-line rounded-2xl p-5 bg-surface-2/20 space-y-4 animate-fade-in text-sm">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-2">
                      <span>{selectedExistingRefereeNrics.length} Referees Selected</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSelectedExistingRefereeNrics([])}
                      className="text-xs text-text-dim hover:text-text underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-1">
                    {selectedAccs.map((acc) => (
                      <span
                        key={acc.nric}
                        className="text-xs bg-surface border border-line px-2.5 py-1 rounded-lg text-text flex items-center gap-1.5"
                      >
                        <span className="font-semibold">{acc.fullName}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
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
                  NRIC Number *
                </label>
                <input
                  type="text"
                  value={refereeNric}
                  onChange={(e) => setRefereeNric(e.target.value)}
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
        )}

        {/* Footer Actions */}
        <div className="p-6 border-t border-line flex justify-end gap-3 bg-surface-2/30 shrink-0">
          <button
            onClick={onClose}
            className="text-text-dim border border-line px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-surface-2 transition cursor-pointer"
          >
            Cancel
          </button>
          {addRefereeModalTab === 'existing' ? (
            <button
              onClick={handleOrganizerAddExistingReferee}
              disabled={selectedExistingRefereeNrics.length === 0}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition shadow flex items-center gap-2 ${
                selectedExistingRefereeNrics.length > 0
                  ? 'bg-gold hover:bg-yellow-400 text-ink cursor-pointer'
                  : 'bg-gold/40 text-ink/50 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              {selectedExistingRefereeNrics.length > 1
                ? `Add ${selectedExistingRefereeNrics.length} Referees`
                : 'Add Referee'}
            </button>
          ) : (
            <button
              onClick={handleOrganizerSaveNewReferee}
              className="bg-gold hover:bg-yellow-400 text-ink px-6 py-2.5 rounded-xl font-bold text-sm transition shadow flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Referee
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
