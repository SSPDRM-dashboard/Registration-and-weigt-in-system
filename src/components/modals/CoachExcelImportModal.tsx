import React from 'react';
import { Upload, X, Download, FileText, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { Competition, Player } from '../../types';

interface CoachExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeComp: Competition | null;
  excelParsedPlayers: Partial<Player>[];
  setExcelParsedPlayers: (players: Partial<Player>[]) => void;
  excelValidationErrors: Array<{ rowNum: number; name: string; error: string }>;
  setExcelValidationErrors: (errors: Array<{ rowNum: number; name: string; error: string }>) => void;
  excelImporting: boolean;
  handleDownloadExcelTemplate: () => void;
  handleCoachExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmCoachExcelImport: () => Promise<void>;
}

export const CoachExcelImportModal: React.FC<CoachExcelImportModalProps> = ({
  isOpen,
  onClose,
  activeComp,
  excelParsedPlayers,
  setExcelParsedPlayers,
  excelValidationErrors,
  setExcelValidationErrors,
  excelImporting,
  handleDownloadExcelTemplate,
  handleCoachExcelUpload,
  handleConfirmCoachExcelImport,
}) => {
  if (!isOpen || !activeComp) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in print:hidden overflow-y-auto">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-scale-up">
        {/* Header */}
        <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-gold/10 p-2 rounded-xl border border-gold/20">
              <Upload className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text uppercase tracking-wider">Excel Competitor Roster Import</h2>
              <p className="text-[11px] text-text-dim">
                Batch-register competitors for <span className="text-gold font-bold">{activeComp.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              setExcelParsedPlayers([]);
              setExcelValidationErrors([]);
            }}
            className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Step 1: Template Download */}
          <div className="bg-surface-2 border border-line p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Download className="w-4 h-4 text-gold" />
                1. Use the Dynamic Excel Template
              </h4>
              <p className="text-[11px] text-text-dim leading-relaxed">
                Download our dynamically generated Excel file pre-filled with this tournament's actual Events, Age
                Divisions, and Weight Classes. Giving this to coaches guarantees error-free registration!
              </p>
            </div>
            <button
              onClick={handleDownloadExcelTemplate}
              className="w-full sm:w-auto bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download Template (.xlsx)</span>
            </button>
          </div>

          {/* Step 2: File Upload Box */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider font-sans">
              2. Upload Completed Excel File
            </label>
            <div className="border-2 border-dashed border-line/60 hover:border-gold/50 rounded-2xl p-6 transition text-center relative group cursor-pointer">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleCoachExcelUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center group-hover:scale-110 transition">
                  <FileText className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text uppercase tracking-wider">
                    Click or drag Excel file here to upload
                  </p>
                  <p className="text-[10px] text-text-dim mt-1">
                    Supports standard .xlsx or .xls spreadsheets containing roster lists
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Excel Format Reference / Instructions */}
          {excelParsedPlayers.length === 0 && (
            <div className="bg-ink/20 border border-line/40 p-4 rounded-2xl space-y-3 animate-fade-in">
              <h4 className="text-xs font-bold text-text uppercase tracking-widest text-gold font-sans flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Excel Column Headers (All Fields are Strictly Required)
              </h4>
              <p className="text-[11px] text-text-dim leading-relaxed font-sans">
                To build or customize your own spreadsheet, ensure the first sheet contains the following headers and that
                every single column is fully filled. Missing or invalid values will cause the row to be flagged and skipped.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                <div className="space-y-1.5">
                  <p className="font-semibold text-text border-b border-line/40 pb-1 uppercase tracking-wider text-gold/90 font-sans">
                    Identity & Core Info
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-text-dim">
                    <li>
                      <strong className="text-text font-sans">Full Name *</strong>: Full name of the competitor.
                    </li>
                    <li>
                      <strong className="text-text font-sans">Gender *</strong>: "Male" or "Female" (or 'L'/'P' in Malay).
                    </li>
                    <li>
                      <strong className="text-text font-sans">NRIC or Passport *</strong>: NRIC number or Passport for
                      automatic verification.
                    </li>
                    <li>
                      <strong className="text-text font-sans">Date of Birth *</strong>: Athlete's birth date (YYYY-MM-DD).
                    </li>
                    <li>
                      <strong className="text-text font-sans">Race *</strong>: Malay, Chinese, Indian, or Lain-lain.
                    </li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-text border-b border-line/40 pb-1 uppercase tracking-wider text-gold/90 font-sans">
                    Category & Club Info
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-text-dim">
                    <li>
                      <strong className="text-text font-sans">Event *</strong>: Tournament option, must match:{' '}
                      <span className="text-text font-mono font-bold text-[10px]">{activeComp.events.join(', ')}</span>.
                    </li>
                    <li>
                      <strong className="text-text font-sans">Age Group *</strong>: Tournament Age division.
                    </li>
                    <li>
                      <strong className="text-text font-sans">Weight Class *</strong>: Athlete's weight category.
                    </li>
                    <li>
                      <strong className="text-text font-sans">School Name *</strong>: School affiliated with the athlete.
                    </li>
                    <li>
                      <strong className="text-text font-sans">School Code *</strong>: Official school code (e.g., BBA0012).
                    </li>
                    <li>
                      <strong className="text-text font-sans">Affiliated Club / State</strong>{' '}
                      <span className="text-xs text-text-dim">(Optional)</span>: Dojang, club, or state team (defaults to
                      coach's club if left blank).
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Parsing Warnings / Errors Box */}
          {excelValidationErrors.length > 0 && (
            <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-2xl space-y-1.5 text-xs animate-fade-in">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-red-400 font-sans">
                <AlertCircle className="w-4 h-4" />
                <span>Row Validation Errors ({excelValidationErrors.length})</span>
              </div>
              <p className="text-[10px] text-red-200/70 mb-2 font-sans">
                The following rows contain missing or invalid required fields. These rows have been skipped. Please correct
                them in your spreadsheet and upload again.
              </p>
              <div className="max-h-40 overflow-y-auto divide-y divide-red-500/10 space-y-1 text-[11px]">
                {excelValidationErrors.map((err, i) => (
                  <div key={i} className="py-1 text-red-200">
                    <span className="font-mono font-bold bg-red-500/20 px-1.5 py-0.5 rounded mr-1">
                      Row {err.rowNum}
                    </span>
                    <strong className="text-text font-sans">{err.name}</strong>: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roster Preview */}
          {excelParsedPlayers.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-text uppercase tracking-widest font-sans">
                  Roster Upload Preview ({excelParsedPlayers.length} athletes parsed)
                </h4>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded">
                  Ready to Save
                </span>
              </div>
              <div className="overflow-x-auto border border-line rounded-2xl">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-line bg-ink/40 text-text-dim font-semibold uppercase tracking-wider">
                      <th className="p-3">#</th>
                      <th className="p-3">Full Name</th>
                      <th className="p-3">Gender</th>
                      <th className="p-3">NRIC / DOB</th>
                      <th className="p-3">Event</th>
                      <th className="p-3">Age Group</th>
                      <th className="p-3">Weight Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {excelParsedPlayers.map((p, idx) => (
                      <tr key={idx} className="hover:bg-surface-2/30">
                        <td className="p-3 font-mono text-gold font-bold">{idx + 1}</td>
                        <td className="p-3 font-bold text-text font-sans">{p.name}</td>
                        <td className="p-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              p.gender === 'Female'
                                ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {p.gender}
                          </span>
                        </td>
                        <td className="p-3 text-text-dim font-sans">
                          <div>{p.ic || <span className="italic text-text-dim/40 font-mono">No IC</span>}</div>
                          <div className="text-[10px] font-mono">{p.dob || <span className="italic text-text-dim/40">No DOB</span>}</div>
                        </td>
                        <td className="p-3 text-gold font-medium font-sans">{p.event}</td>
                        <td className="p-3 text-text font-sans">{p.ageGroup}</td>
                        <td className="p-3 text-text font-semibold font-sans">{p.weightClass}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-2/50 flex justify-between gap-3 shrink-0">
          <button
            onClick={handleDownloadExcelTemplate}
            className="px-4 py-2.5 rounded-xl text-gold border border-gold/20 hover:bg-gold/5 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer font-sans"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Get Template</span>
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                setExcelParsedPlayers([]);
                setExcelValidationErrors([]);
              }}
              className="px-4 py-2.5 rounded-xl text-text-dim hover:text-text font-bold text-xs hover:bg-surface border border-line transition cursor-pointer font-sans"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={excelParsedPlayers.length === 0 || excelImporting}
              onClick={handleConfirmCoachExcelImport}
              className={`bg-gold hover:bg-yellow-400 text-ink px-5 py-2.5 rounded-xl font-bold text-xs transition shadow flex items-center gap-1.5 font-sans ${
                excelParsedPlayers.length === 0 || excelImporting ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {excelImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm Import ({excelParsedPlayers.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
