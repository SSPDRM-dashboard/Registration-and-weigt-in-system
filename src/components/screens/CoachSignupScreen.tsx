import React from 'react';
import { UserPlus } from 'lucide-react';

interface CoachSignupScreenProps {
  sUser: string;
  setSUser: (val: string) => void;
  sPass: string;
  setSPass: (val: string) => void;
  sName: string;
  setSName: (val: string) => void;
  sClub: string;
  setSClub: (val: string) => void;
  sPhone: string;
  setSPhone: (val: string) => void;
  sEmail: string;
  setSEmail: (val: string) => void;
  handleCoachSignup: () => void | Promise<void>;
  setScreen: (screen: any) => void;
}

export const CoachSignupScreen: React.FC<CoachSignupScreenProps> = ({
  sUser,
  setSUser,
  sPass,
  setSPass,
  sName,
  setSName,
  sClub,
  setSClub,
  sPhone,
  setSPhone,
  sEmail,
  setSEmail,
  handleCoachSignup,
  setScreen,
}) => {
  return (
    <div className="max-w-md mx-auto my-12 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden transition-all duration-300">
      <div className="p-6 bg-gradient-to-b from-surface-2/50 to-transparent border-b border-line text-center">
        <UserPlus className="w-10 h-10 text-gold mx-auto mb-2" />
        <h2 className="text-xl font-bold uppercase tracking-wider text-text font-sans">New Coach Token</h2>
        <p className="text-xs text-text-dim mt-1">Acquire an authorization credentials block</p>
      </div>
      <div className="p-6 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
            Coach Username
          </label>
          <input
            type="text"
            value={sUser}
            onChange={(e) => setSUser(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCoachSignup();
            }}
            className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
            Password
          </label>
          <input
            type="password"
            value={sPass}
            onChange={(e) => setSPass(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCoachSignup();
            }}
            className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
            Full Coach Name
          </label>
          <input
            type="text"
            value={sName}
            onChange={(e) => setSName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCoachSignup();
            }}
            placeholder="Ali Bin Ahmad"
            className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
            Representing Club/State
          </label>
          <input
            type="text"
            value={sClub}
            onChange={(e) => setSClub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCoachSignup();
            }}
            placeholder="PERSATUAN TAEKWONDO NEGERI PERAK"
            className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={sPhone}
            onChange={(e) => setSPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCoachSignup();
            }}
            placeholder="+6012-3456789"
            className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={sEmail}
            onChange={(e) => setSEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCoachSignup();
            }}
            placeholder="coach@example.com"
            className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
          />
        </div>
        <button
          onClick={handleCoachSignup}
          className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-4 cursor-pointer shadow-md"
        >
          Activate Coach Credentials
        </button>
        <p className="text-center text-xs text-text-dim pt-2">
          Already authorized?{' '}
          <button
            onClick={() => setScreen('login')}
            className="text-gold underline font-semibold hover:text-opacity-80 cursor-pointer"
          >
            Return to portal login
          </button>
        </p>
      </div>
    </div>
  );
};
