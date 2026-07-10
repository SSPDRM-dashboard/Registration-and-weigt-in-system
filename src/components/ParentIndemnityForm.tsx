import React, { useState, useRef, useEffect } from 'react';
import { 
  Trophy, ShieldAlert, CheckCircle, Calendar, MapPin, User, 
  PenTool, Check, Activity, FileText, AlertCircle, Search, ArrowLeft, ShieldCheck 
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Player, Competition } from '../types';
import { savePlayerToFirestore, subscribeToPlayersForComp } from '../firebase';

interface ParentIndemnityFormProps {
  indemnityPlayer: Player | null;
  indemnityComp: Competition | null;
  indemnityLoading: boolean;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
  setScreen: (screen: string) => void;
}

export default function ParentIndemnityForm({
  indemnityPlayer,
  indemnityComp,
  indemnityLoading,
  triggerMsg,
  setScreen
}: ParentIndemnityFormProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedDropdownPlayerId, setSelectedDropdownPlayerId] = useState('');
  const [tempSelectedPlayer, setTempSelectedPlayer] = useState<Player | null>(null);

  // Form Inputs
  const [parentName, setParentName] = useState('');
  const [parentIc, setParentIc] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [relationship, setRelationship] = useState('Father');
  
  // Consent Checkboxes
  const [consentDeclaration, setConsentDeclaration] = useState(false);
  const [consentMedical, setConsentMedical] = useState(false);
  const [consentLiability, setConsentLiability] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sigCanvasRef = useRef<SignatureCanvas>(null);

  // Sync selected player if prop changes
  useEffect(() => {
    if (indemnityPlayer) {
      setSelectedPlayer(indemnityPlayer);
    } else {
      setSelectedPlayer(null);
    }
  }, [indemnityPlayer]);

  // Load players if competition is provided and no specific athlete is pre-selected
  useEffect(() => {
    if (indemnityComp && !indemnityPlayer) {
      setLoadingPlayers(true);
      const unsubscribe = subscribeToPlayersForComp(
        indemnityComp.id,
        (players) => {
          // Sort players by name alphabetically
          const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
          setPlayersList(sorted);
          setLoadingPlayers(false);
        },
        (err) => {
          console.error(err);
          setLoadingPlayers(false);
        }
      );
      return () => unsubscribe();
    }
  }, [indemnityComp, indemnityPlayer]);

  if (indemnityLoading) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-surface rounded-2xl border border-line shadow-xl text-center space-y-4">
        <Activity className="w-12 h-12 text-gold animate-spin mx-auto" />
        <h3 className="text-lg font-bold text-text uppercase tracking-widest">Verifying Credentials</h3>
        <p className="text-xs text-text-dim">Retrieving secure digital registration and tournament parameters from cloud servers...</p>
      </div>
    );
  }

  // If no competition record is found at all, we show access denied
  if (!indemnityComp) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-surface rounded-2xl border border-line shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-text uppercase tracking-wider">Access Denied</h3>
          <p className="text-xs text-text-dim leading-relaxed">
            We could not locate an active tournament record matching this digital indemnity token.
          </p>
        </div>
        <p className="text-[11px] bg-ink/50 p-3 rounded-lg text-text-dim text-left border border-line">
          Please contact your club's Head Coach or Team Manager to generate a valid, up-to-date parental consent form link.
        </p>
        <button 
          onClick={() => setScreen('login')}
          className="w-full bg-surface-2 hover:bg-line text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl border border-line transition text-text cursor-pointer"
        >
          Return to Portal Login
        </button>
      </div>
    );
  }

  const handleClearSignature = (e: React.MouseEvent) => {
    e.preventDefault();
    sigCanvasRef.current?.clear();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlayer) {
      triggerMsg('Please select a competitor to proceed.', 'error');
      return;
    }
    if (!parentName.trim()) {
      triggerMsg('Please enter parent/guardian full name.', 'error');
      return;
    }
    if (!parentIc.trim()) {
      triggerMsg('Please enter parent/guardian NRIC/Passport number.', 'error');
      return;
    }
    if (!parentPhone.trim()) {
      triggerMsg('Please enter parent/guardian mobile number.', 'error');
      return;
    }
    if (!consentDeclaration || !consentMedical || !consentLiability) {
      triggerMsg('You must agree to all release and consent conditions to proceed.', 'error');
      return;
    }

    if (sigCanvasRef.current?.isEmpty()) {
      triggerMsg('Please sign the digital consent board to authenticate your authorization.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const signatureDataUrl = sigCanvasRef.current?.getTrimmedCanvas().toDataURL('image/png') || '';

      const updatedPlayer: Player = {
        ...selectedPlayer,
        indemnityStatus: 'Completed',
        indemnityParentName: parentName.trim(),
        indemnityParentIc: parentIc.trim(),
        indemnityParentPhone: parentPhone.trim(),
        indemnityParentEmail: parentEmail.trim(),
        indemnityRelationship: relationship,
        indemnitySignedDate: new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
        indemnitySignedIp: 'Client-device',
        indemnitySignature: signatureDataUrl
      };

      await savePlayerToFirestore(updatedPlayer);
      setSubmitted(true);
      triggerMsg('Parental Indemnity Form submitted successfully!', 'ok');
    } catch (err) {
      console.error(err);
      triggerMsg('An error occurred while saving parental consent. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS SUBMITTED VIEW
  if (submitted && selectedPlayer) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-surface rounded-2xl border border-emerald-500/20 shadow-2xl text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-text uppercase tracking-widest">Form Received</h3>
          <p className="text-sm font-semibold text-emerald-400">Indemnity Authenticated Successfully</p>
          <p className="text-xs text-text-dim leading-relaxed">
            Thank you. Parental consent for <strong className="text-text">{selectedPlayer.name}</strong> has been secured and digitally appended to their registration profile.
          </p>
        </div>
        <div className="bg-ink/50 p-4 rounded-xl border border-line text-left text-[11px] space-y-1.5 font-mono text-text-dim">
          <div><span className="text-gold">Athlete Name:</span> {selectedPlayer.name}</div>
          <div><span className="text-gold">Guardian:</span> {parentName}</div>
          <div><span className="text-gold">Timestamp:</span> {new Date().toLocaleString()}</div>
          <div><span className="text-gold">Verification Status:</span> Cloud Active</div>
        </div>
        <p className="text-xs text-text-dim italic">
          Your club Head Coach has been notified in real-time. You may now close this browser tab safely.
        </p>
      </div>
    );
  }

  // SELECT CHILD VIEW (when indemnityPlayer prop was null and parent must choose their child)
  if (!selectedPlayer) {
    const filteredPlayers = playersList.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.club.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ic.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="max-w-xl mx-auto my-6 bg-surface rounded-2xl border border-line shadow-xl overflow-hidden animate-fade-in">
        {/* Banner */}
        <div className="p-6 bg-gradient-to-b from-gold/10 to-transparent border-b border-line text-center relative">
          <Trophy className="w-8 h-8 text-gold mx-auto mb-1.5" />
          <h2 className="text-lg font-bold uppercase tracking-wider text-text">{indemnityComp.name}</h2>
          <p className="text-xs text-text-dim">Parental Consent & Liability Release Portal</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Tournament details */}
          <div className="bg-ink/40 p-4 rounded-xl border border-line/50 space-y-2 text-xs">
            <span className="text-gold font-bold uppercase tracking-wider block">Championship Venue & Schedule</span>
            <div className="flex flex-col sm:flex-row gap-3 justify-between font-medium text-text-dim">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                <span>{indemnityComp.venue}</span>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-gold shrink-0" />
                <span>{indemnityComp.date}</span>
              </span>
            </div>
          </div>

          {/* Search/Select Dropdown Field */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gold uppercase tracking-wider">
              1. PLAYER
            </label>
            <p className="text-xs text-text-dim leading-relaxed">
              Search or select your child's name from the registered competitors dropdown list below.
            </p>
            
            {/* Quick search filter to narrow down dropdown options */}
            <div className="relative">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type name or NRIC to filter list... (optional)"
                className="w-full bg-ink border border-line text-xs rounded-xl py-2.5 pl-10 pr-4 text-text focus:outline-none focus:border-gold transition"
              />
              <Search className="w-4 h-4 text-text-dim absolute left-3.5 top-3" />
            </div>

            {/* Dropdown Select */}
            <div className="mt-2">
              <select
                value={selectedDropdownPlayerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDropdownPlayerId(val);
                  const p = playersList.find(player => player.id === val);
                  setTempSelectedPlayer(p || null);
                }}
                className="w-full bg-ink border border-line text-sm rounded-xl py-3 px-4 text-text focus:outline-none focus:border-gold transition cursor-pointer font-semibold uppercase tracking-wide"
              >
                <option value="" className="text-text-dim">-- Choose Competitor --</option>
                {filteredPlayers.map((p) => {
                  const statusSuffix = p.indemnityStatus === 'Completed' ? ' (✓ Waiver Signed)' : '';
                  return (
                    <option key={p.id} value={p.id} className="bg-surface text-text">
                      {p.name.toUpperCase()} [{p.club.toUpperCase()}] - {p.ic}{statusSuffix}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Show loading state if players are loading */}
          {loadingPlayers && (
            <div className="p-8 text-center text-xs text-text-dim flex items-center justify-center gap-2">
              <Activity className="w-4 h-4 text-gold animate-spin" />
              <span>Loading competitors list from live servers...</span>
            </div>
          )}

          {/* Selected Player Summary Card and Actions */}
          {!loadingPlayers && tempSelectedPlayer && (
            <div className="bg-ink/30 border border-line p-5 rounded-2xl space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-line/30">
                <div>
                  <h4 className="text-sm font-extrabold text-text uppercase">{tempSelectedPlayer.name}</h4>
                  <p className="text-[11px] text-text-dim font-mono">NRIC/Passport: {tempSelectedPlayer.ic}</p>
                </div>
                <div>
                  {tempSelectedPlayer.indemnityStatus === 'Completed' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 font-mono">
                      ✓ CONSENT SECURED
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-500/20 font-mono">
                      PENDING CONSENT
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div>
                  <span className="text-text-dim block">Represented Club:</span>
                  <strong className="text-text uppercase">{tempSelectedPlayer.club}</strong>
                </div>
                <div>
                  <span className="text-text-dim block">Category / Event:</span>
                  <strong className="text-text">{tempSelectedPlayer.event}</strong>
                </div>
                <div>
                  <span className="text-text-dim block">Weight Class:</span>
                  <strong className="text-text">{tempSelectedPlayer.weightClass}</strong>
                </div>
                <div>
                  <span className="text-text-dim block">Age Division:</span>
                  <strong className="text-text">{tempSelectedPlayer.ageGroup}</strong>
                </div>
              </div>

              {tempSelectedPlayer.indemnityStatus === 'Completed' ? (
                <div className="bg-emerald-950/20 border border-emerald-500/15 p-3 rounded-xl text-[11px] text-emerald-400 leading-relaxed">
                  This competitor's parental consent and digital indemnity waiver have already been signed and logged securely. No further action is required.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(tempSelectedPlayer)}
                  className="w-full bg-gold text-ink hover:bg-gold/90 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <PenTool className="w-4 h-4" />
                  <span>Select & Fill Waiver Form</span>
                </button>
              )}
            </div>
          )}

          {/* No matches warning */}
          {!loadingPlayers && filteredPlayers.length === 0 && searchQuery && (
            <div className="p-8 text-center border border-dashed border-line rounded-xl text-text-dim space-y-2">
              <AlertCircle className="w-6 h-6 text-text-dim/60 mx-auto" />
              <p className="text-xs font-bold">No registered competitors found matching "{searchQuery}".</p>
              <p className="text-[11px]">Please double-check the spelling or ask your Head Coach to register them.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // INDEMNITY FORM FOR THE CHOSEN CHILD
  return (
    <div className="max-w-2xl mx-auto my-6 bg-surface rounded-2xl border border-line shadow-xl overflow-hidden animate-fade-in">
      {/* Banner */}
      <div className="p-6 bg-gradient-to-b from-gold/10 to-transparent border-b border-line text-center relative">
        {/* Back Link if the parent loaded via comp link */}
        {indemnityComp && !indemnityPlayer && (
          <button
            type="button"
            onClick={() => setSelectedPlayer(null)}
            className="absolute left-4 top-6 text-xs text-text-dim hover:text-gold flex items-center gap-1 font-semibold transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Choose another</span>
          </button>
        )}

        <Trophy className="w-8 h-8 text-gold mx-auto mb-1.5" />
        <h2 className="text-lg font-bold uppercase tracking-wider text-text">Parental Consent & Indemnity</h2>
        <p className="text-xs text-text-dim">Official Taekwondo Tournament Authorization Terminal</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        {/* SECTION 1: TOURNAMENT DETAILS */}
        <div className="bg-ink/40 p-4 rounded-xl border border-line/50 space-y-3">
          <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>1. Tournament Details</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-text-dim block">Championship:</span>
              <span className="font-bold text-text block">{indemnityComp.name}</span>
            </div>
            <div className="space-y-1">
              <span className="text-text-dim block">Date & Venue:</span>
              <span className="font-semibold text-text block flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gold" />
                <span>{indemnityComp.venue} · {indemnityComp.date}</span>
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: ATHLETE DEMOGRAPHICS */}
        <div className="bg-ink/40 p-4 rounded-xl border border-line/50 space-y-3">
          <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4" />
            <span>2. Competitor (Child) Information</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-text-dim font-sans">Competitor Name:</span>
              <p className="font-bold text-text uppercase text-sm mt-0.5">{selectedPlayer.name}</p>
            </div>
            <div>
              <span className="text-text-dim font-sans">NRIC / Passport No:</span>
              <p className="font-bold text-text mt-0.5">{selectedPlayer.ic}</p>
            </div>
            <div>
              <span className="text-text-dim font-sans">Division / Event:</span>
              <p className="font-bold text-gold mt-0.5">{selectedPlayer.event} ({selectedPlayer.ageGroup})</p>
            </div>
            <div>
              <span className="text-text-dim font-sans">Target Weight Class:</span>
              <p className="font-bold text-text mt-0.5">{selectedPlayer.weightClass}</p>
            </div>
            <div className="sm:col-span-2 pt-1.5 border-t border-line/20">
              <span className="text-text-dim font-sans">Representing Club:</span>
              <p className="font-bold text-text uppercase mt-0.5">{selectedPlayer.club}</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: PARENTAL GUARDIAN DEMOGRAPHICS */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 border-b border-line pb-1.5">
            <User className="w-4 h-4" />
            <span>3. Parent / Guardian Details</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider mb-1.5">Parent/Guardian Name *</label>
              <input 
                type="text"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="e.g. Ahmad bin Sulaiman"
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider mb-1.5">Parent/Guardian NRIC / Passport *</label>
              <input 
                type="text"
                required
                value={parentIc}
                onChange={(e) => setParentIc(e.target.value)}
                placeholder="e.g. 780915105431"
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider mb-1.5">Relationship to Athlete *</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Legal Guardian">Legal Guardian</option>
                <option value="Others">Others</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider mb-1.5">Mobile Contact Number *</label>
              <input 
                type="text"
                required
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="e.g. +60123456789"
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider mb-1.5">Email Address (Optional)</label>
              <input 
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="e.g. parent@example.com"
                className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: RELEASE CONDITIONS & LEGAL DECREES */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 border-b border-line pb-1.5">
            <ShieldAlert className="w-4 h-4" />
            <span>4. Declarations & Liability Release</span>
          </h3>

          <div className="bg-ink/60 border border-line/80 rounded-xl p-4 text-[11px] leading-relaxed text-text-dim max-h-48 overflow-y-auto space-y-3 scrollbar-thin">
            <p>
              <strong>1. AUTHORIZATION OF PARTICIPATION:</strong> I, being the lawful parent/guardian of the competitor specified above, hereby authorize and grant full permission for my child to actively participate in the designated Taekwondo championship tournament.
            </p>
            <p>
              <strong>2. INDEMNITY & ASSUMPTION OF RISK:</strong> I fully acknowledge that Taekwondo is a full-contact combat martial art involving high kicks, punches, sparring (Kyorugi), and technical movements (Poomsae). I recognize that participating in these athletic activities carries inherent risks of physical collision, skeletal trauma, injury, or severe medical emergencies. I voluntarily assume all risks associated with my child's participation.
            </p>
            <p>
              <strong>3. RELEASE OF LIABILITY:</strong> In consideration of the registration approval, I hereby fully release, hold harmless, and indemnify the event organizers, the state/national sports bodies, the host venue management, the officiating referees, and club coaches from any and all legal liabilities, insurance claims, medical costs, damages, or personal loss arising directly or indirectly from tournament bouts or administrative proceedings.
            </p>
            <p>
              <strong>4. MEDICAL ACCIDENT CLAUSE:</strong> I certify that my child is physically active, structurally sound, medically fit, and fully trained to enter a competitive arena. In the event of an emergency injury, I authorize the on-site certified medical team or first responders to perform first aid, triage, and execute emergency hospital evacuation.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 text-xs text-text cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={consentDeclaration}
                onChange={(e) => setConsentDeclaration(e.target.checked)}
                className="mt-0.5 rounded border-line bg-ink text-gold focus:ring-gold focus:ring-opacity-25"
              />
              <span>I hereby certify that I am the legal parent or lawful guardian of the competitor, and declare all entered information is true.</span>
            </label>
            
            <label className="flex items-start gap-3 text-xs text-text cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={consentMedical}
                onChange={(e) => setConsentMedical(e.target.checked)}
                className="mt-0.5 rounded border-line bg-ink text-gold focus:ring-gold focus:ring-opacity-25"
              />
              <span>I guarantee that my child is medically fit, adequately conditioned, and free of physical ailments or infectious diseases.</span>
            </label>

            <label className="flex items-start gap-3 text-xs text-text cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={consentLiability}
                onChange={(e) => setConsentLiability(e.target.checked)}
                className="mt-0.5 rounded border-line bg-ink text-gold focus:ring-gold focus:ring-opacity-25"
              />
              <span>I explicitly read, comprehend, and accept the assumption of physical risks, liability exemptions, and the legal waiver.</span>
            </label>
          </div>
        </div>

        {/* SECTION 5: SIGNATURE CANVAS */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gold uppercase tracking-wider flex justify-between items-center">
            <span>5. Parent / Guardian Digital Signature *</span>
            <button 
              type="button"
              onClick={handleClearSignature}
              className="text-[10px] text-text-dim hover:text-gold border border-line rounded-lg px-2 py-0.5 bg-ink font-mono transition cursor-pointer"
            >
              Clear Drawing Board
            </button>
          </label>
          <div className="border border-line rounded-xl bg-white overflow-hidden h-36 relative shadow-inner">
            <SignatureCanvas 
              ref={sigCanvasRef}
              penColor="black"
              canvasProps={{ className: 'w-full h-full' }} 
            />
          </div>
          <p className="text-[10px] text-text-dim flex items-center gap-1 font-mono italic">
            <AlertCircle className="w-3.5 h-3.5 text-gold shrink-0" />
            <span>Draw your signature with touch/mouse. Digital signatures are saved as legal certification.</span>
          </p>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gold text-ink hover:bg-gold/90 disabled:opacity-50 font-bold uppercase tracking-wider py-3.5 rounded-xl text-xs transition duration-300 shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          {submitting ? (
            <>
              <Activity className="w-4 h-4 animate-spin" />
              <span>Verifying & Saving to Cloud...</span>
            </>
          ) : (
            <>
              <PenTool className="w-4 h-4" />
              <span>Sign & Authorize Indemnity Waiver</span>
            </>
          )}
        </button>

      </form>
    </div>
  );
}
