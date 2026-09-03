import React from 'react';
import { Trophy, Edit, ChevronRight, MapPin, Calendar } from 'lucide-react';
import { Competition, Coach } from '../../types';

interface CoachHomeScreenProps {
  user: string | null;
  coaches: Record<string, Coach>;
  competitions: Competition[];
  setCompId: (id: string) => void;
  setScreen: (screen: any) => void;
  setCoachName: (name: string) => void;
  setCoachClub: (club: string) => void;
  setCoachPhone: (phone: string) => void;
  setCoachPassword: (pass: string) => void;
  setCoachUsername: (user: string) => void;
  setShowCoachEditProfile: (show: boolean) => void;
  formatDateRange: (start?: string, end?: string) => string;
}

export const CoachHomeScreen: React.FC<CoachHomeScreenProps> = ({
  user,
  coaches,
  competitions,
  setCompId,
  setScreen,
  setCoachName,
  setCoachClub,
  setCoachPhone,
  setCoachPassword,
  setCoachUsername,
  setShowCoachEditProfile,
  formatDateRange,
}) => {
  const currentCoach = coaches[user || ''];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wider text-text flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" />
            <span>Welcome back, Coach {currentCoach?.name}</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">
            Representing: <strong className="text-text">{currentCoach?.club}</strong>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
            Verified Club Registrar Account
          </div>
          <button
            onClick={() => {
              if (currentCoach) {
                setCoachName(currentCoach.name || '');
                setCoachClub(currentCoach.club || '');
                setCoachPhone(currentCoach.phone || '');
                setCoachPassword(currentCoach.password || '');
                setCoachUsername(user || '');
                setShowCoachEditProfile(true);
              }
            }}
            className="text-xs border border-line hover:border-gold text-text-dim hover:text-gold px-3 py-1.5 rounded-lg transition font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Edit className="w-3 h-3" />
            Edit Profile
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-dim uppercase tracking-wider">
          Select active championship tournament
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.filter((c) => c.isActive !== false).length === 0 ? (
            <div className="col-span-full bg-surface p-8 rounded-2xl border border-line text-center">
              <Trophy className="w-8 h-8 text-text-dim/50 mx-auto mb-2" />
              <p className="text-sm text-text-dim uppercase tracking-wider">No active tournaments available</p>
            </div>
          ) : (
            competitions
              .filter((c) => c.isActive !== false)
              .map((c) => {
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setCompId(c.id);
                      setScreen('coachRoster');
                    }}
                    className="bg-surface border border-line hover:border-gold/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 shadow-sm hover:shadow group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-emerald-950 text-gold p-2.5 rounded-xl border border-emerald-900/50">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-dim/70 group-hover:text-gold transition-colors" />
                    </div>
                    <h4 className="text-base font-bold text-text font-sans uppercase leading-tight group-hover:text-gold transition-colors">
                      {c.name}
                    </h4>
                    <p className="text-xs text-text-dim mt-2 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {c.venue}
                    </p>
                    <p className="text-xs text-text-dim mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {formatDateRange(c.date, c.endDate)}
                    </p>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};
