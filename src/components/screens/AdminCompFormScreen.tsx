import React from 'react';
import { CurrencySelector } from '../CurrencySelector';

interface AdminCompFormScreenProps {
  ncName: string;
  setNcName: (val: string) => void;
  ncVenue: string;
  setNcVenue: (val: string) => void;
  ncDate: string;
  setNcDate: (val: string) => void;
  ncEndDate: string;
  setNcEndDate: (val: string) => void;
  ncRegistrationCloseDate: string;
  setNcRegistrationCloseDate: (val: string) => void;
  ncCode: string;
  setNcCode: (val: string) => void;
  ncCurrency: string;
  setNcCurrency: (val: string) => void;
  handleCreateComp: () => void | Promise<void>;
  setScreen: (screen: any) => void;
}

export const AdminCompFormScreen: React.FC<AdminCompFormScreenProps> = ({
  ncName,
  setNcName,
  ncVenue,
  setNcVenue,
  ncDate,
  setNcDate,
  ncEndDate,
  setNcEndDate,
  ncRegistrationCloseDate,
  setNcRegistrationCloseDate,
  ncCode,
  setNcCode,
  ncCurrency,
  setNcCurrency,
  handleCreateComp,
  setScreen,
}) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setScreen('adminHome')}
          className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition cursor-pointer"
        >
          ← Back to admin panel
        </button>
        <h2 className="text-xl font-bold uppercase tracking-wider text-text">Create Championship Event</h2>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-6 space-y-4 shadow-xl">
        <div>
          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
            Official Tournament Title
          </label>
          <input
            type="text"
            value={ncName}
            onChange={(e) => setNcName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateComp();
            }}
            placeholder="e.g. State Championship 2026"
            className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
              Venue Location
            </label>
            <input
              type="text"
              value={ncVenue}
              onChange={(e) => setNcVenue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateComp();
              }}
              placeholder="e.g. National Arena"
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
              Tournament Start Date
            </label>
            <input
              type="date"
              value={ncDate}
              onChange={(e) => setNcDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateComp();
              }}
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
              Tournament End Date
            </label>
            <input
              type="date"
              value={ncEndDate}
              onChange={(e) => setNcEndDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateComp();
              }}
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
              Registration Close Date
            </label>
            <input
              type="date"
              value={ncRegistrationCloseDate}
              onChange={(e) => setNcRegistrationCloseDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateComp();
              }}
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencySelector
            value={ncCurrency}
            onChange={setNcCurrency}
            label="Tournament Currency"
          />

          <div>
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
              Weigh-in Staff Security Passcode
            </label>
            <input
              type="text"
              value={ncCode}
              onChange={(e) => setNcCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateComp();
              }}
              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition font-mono"
            />
            <p className="text-[10px] text-text-dim/60 mt-1">
              Used for scale station terminal access.
            </p>
          </div>
        </div>

        <div className="pt-4 flex items-center space-x-3 border-t border-line/40">
          <button
            onClick={handleCreateComp}
            className="bg-gold hover:opacity-90 text-ink font-bold px-5 py-2.5 rounded-xl text-xs shadow-md cursor-pointer"
          >
            Create tournament event
          </button>
          <button
            onClick={() => setScreen('adminHome')}
            className="bg-ink text-text-dim border border-line hover:text-text px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
