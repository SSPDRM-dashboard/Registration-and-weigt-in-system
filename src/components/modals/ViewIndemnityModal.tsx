import React from 'react';
import { ShieldCheck, X, Printer } from 'lucide-react';
import { Competition, Player } from '../../types';

interface ViewIndemnityModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIndemnityPlayer: Player | null;
  activeComp: Competition | null;
}

export const ViewIndemnityModal: React.FC<ViewIndemnityModalProps> = ({
  isOpen,
  onClose,
  selectedIndemnityPlayer,
  activeComp,
}) => {
  if (!isOpen || !selectedIndemnityPlayer) return null;

  const handlePrint = () => {
    const printContents = document.querySelector('.printable-indemnity-canvas')?.innerHTML;
    if (printContents) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>Indemnity Certificate - ${selectedIndemnityPlayer.name}</title>
              <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            </head>
            <body class="bg-white p-8">
              <div class="max-w-2xl mx-auto border-2 border-slate-300 rounded-3xl p-6 shadow-md bg-white text-slate-900 font-sans">
                ${printContents}
              </div>
              <script>
                window.onload = function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
                };
              </script>
            </body>
          </html>
        `);
        win.document.close();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-line bg-gradient-to-b from-surface-2/50 to-transparent flex justify-between items-center shrink-0 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display">
                Consent & Indemnity Form
              </h2>
              <p className="text-xs text-emerald-400 font-mono">Status: Digitally Signed & Certified</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text p-1.5 hover:bg-surface-2 rounded-xl border border-transparent hover:border-line transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Printable Consent Certificate */}
        <div className="p-8 overflow-y-auto flex-grow space-y-6 bg-white text-slate-900 font-sans printable-indemnity-canvas">
          {/* Certificate Header */}
          <div className="text-center border-b-2 border-slate-200 pb-4 space-y-1">
            <div className="font-extrabold text-xl uppercase tracking-wider text-slate-900">
              Official Liability Waiver & Indemnity Form
            </div>
            <div className="text-xs font-bold text-emerald-600 tracking-widest uppercase flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Secure Digital Consent Certification</span>
            </div>
          </div>

          {/* Tournament & Competitor Meta */}
          <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-100 pb-4">
            <div className="space-y-1.5">
              <div className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                Championship Event Details
              </div>
              <div className="font-extrabold text-slate-800 text-sm">
                {activeComp?.name || 'Taekwondo Tournament'}
              </div>
              <div className="text-slate-600 font-medium">
                {activeComp?.venue} · {activeComp?.date}
              </div>
            </div>
            <div className="space-y-1.5 border-l border-slate-200 pl-4 font-mono">
              <div className="text-slate-500 uppercase tracking-wider text-[10px] font-bold font-sans">
                Verification Fingerprint
              </div>
              <div>
                <span className="text-slate-400">Athlete ID:</span>{' '}
                <span className="font-bold text-slate-800">{selectedIndemnityPlayer.id}</span>
              </div>
              <div>
                <span className="text-slate-400">Division:</span>{' '}
                <span className="font-bold text-slate-800">{selectedIndemnityPlayer.event}</span>
              </div>
              <div>
                <span className="text-slate-400">Class:</span>{' '}
                <span className="font-bold text-slate-800">{selectedIndemnityPlayer.weightClass}</span>
              </div>
            </div>
          </div>

          {/* Roster & Participant Info */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
            <div className="font-bold text-slate-700 border-b border-slate-200 pb-1">COMPETITOR (CHILD) PARAMETERS</div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div>
                <span className="text-slate-500">Full Name:</span>{' '}
                <strong className="text-slate-900 uppercase block">{selectedIndemnityPlayer.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">NRIC No:</span>{' '}
                <strong className="text-slate-900 block">{selectedIndemnityPlayer.ic}</strong>
              </div>
              <div>
                <span className="text-slate-500">School Affiliation:</span>{' '}
                <strong className="text-slate-900 block">
                  {selectedIndemnityPlayer.schoolName || 'N/A'}{' '}
                  {selectedIndemnityPlayer.schoolCode ? `(${selectedIndemnityPlayer.schoolCode})` : ''}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Represented Club:</span>{' '}
                <strong className="text-slate-900 uppercase block">{selectedIndemnityPlayer.club}</strong>
              </div>
            </div>
          </div>

          {/* Guardian Info */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
            <div className="font-bold text-slate-700 border-b border-slate-200 pb-1">PARENT / GUARDIAN CONFIRMATION</div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div>
                <span className="text-slate-500">Guardian Full Name:</span>{' '}
                <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityParentName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Guardian NRIC:</span>{' '}
                <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityParentIc}</strong>
              </div>
              <div>
                <span className="text-slate-500">Relationship to Athlete:</span>{' '}
                <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityRelationship}</strong>
              </div>
              <div>
                <span className="text-slate-500">Contact Number:</span>{' '}
                <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityParentPhone}</strong>
              </div>
              {selectedIndemnityPlayer.indemnityParentEmail && (
                <div className="col-span-2">
                  <span className="text-slate-500">Email Address:</span>{' '}
                  <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityParentEmail}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Waiver Clause Summary */}
          <div className="text-[10px] text-slate-500 leading-relaxed space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="font-bold text-slate-700">INDEMNITY RELEASE SUMMARY</div>
            <p>
              I, the undersigned parent/guardian, hereby declare that I gave absolute permission for my child to compete in
              this tournament. I voluntarily assume all physical risks of Taekwondo full-contact competition, exempt the
              tournament management and coaches from any legal liabilities, and verify that the competitor is medically
              sound and fully fit to participate.
            </p>
          </div>

          {/* Signature display block */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="text-xs space-y-1 font-mono text-slate-500">
              <div className="font-bold text-slate-700 font-sans">SECURITY DETAILS</div>
              <div>
                Signed Date: <strong className="text-slate-800">{selectedIndemnityPlayer.indemnitySignedDate}</strong>
              </div>
              <div>
                IP Address:{' '}
                <strong className="text-slate-800">{selectedIndemnityPlayer.indemnitySignedIp || 'Client-device'}</strong>
              </div>
              <div className="text-[10px] text-slate-400 mt-2">Verified via Cloud Record</div>
            </div>
            <div className="space-y-1.5 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Guardian Signature</span>
              <div className="border border-slate-200 rounded-lg p-2 bg-slate-100 w-full h-24 flex items-center justify-center overflow-hidden">
                {selectedIndemnityPlayer.indemnitySignature ? (
                  <img
                    src={selectedIndemnityPlayer.indemnitySignature}
                    alt="Parent Signature"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 italic">No signature image found</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-line bg-surface-2 flex justify-between items-center shrink-0 print:hidden">
          <button
            onClick={handlePrint}
            className="bg-gold text-ink font-bold hover:bg-gold/90 px-4 py-2 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Consent Certificate</span>
          </button>

          <button
            onClick={onClose}
            className="bg-ink hover:bg-surface border border-line font-bold text-text px-4 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            Close Certificate
          </button>
        </div>
      </div>
    </div>
  );
};
