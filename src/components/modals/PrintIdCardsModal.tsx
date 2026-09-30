import React, { useState, useRef } from 'react';
import { 
  Printer, Download, Search, X, CheckCircle, RefreshCw, User, 
  FileText, Sparkles, Filter, ChevronDown, Check, AlertCircle, Image as ImageIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as htmlToImage from 'html-to-image';
import JSZip from 'jszip';
import { Competition, Player, IdCardField } from '../../types';
import { beltColorFor } from '../../demoData';

interface PrintIdCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeComp: Competition | null;
  players: Player[];
  staffPasses?: Player[];
  initialClubFilter?: string;
  triggerMsg: (text: string, type: 'error' | 'ok') => void;
  getIdCardFields: (comp: Competition) => IdCardField[];
}

export const PrintIdCardsModal: React.FC<PrintIdCardsModalProps> = ({
  isOpen,
  onClose,
  activeComp,
  players,
  staffPasses = [],
  initialClubFilter,
  triggerMsg,
  getIdCardFields
}) => {
  if (!isOpen || !activeComp) return null;

  // Filter state
  const [selectedClub, setSelectedClub] = useState<string>(initialClubFilter || 'all');
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeStaff, setIncludeStaff] = useState<boolean>(false);
  const [printLayout, setPrintLayout] = useState<'a4-grid' | 'single' | 'badges-8'>('a4-grid');

  // Download & Progress state
  const [isGeneratingZip, setIsGeneratingZip] = useState<boolean>(false);
  const [progressCount, setProgressCount] = useState<number>(0);
  const [progressTotal, setProgressTotal] = useState<number>(0);
  const cancelZipRef = useRef<boolean>(false);

  // Single card download state
  const [downloadingCardId, setDownloadingCardId] = useState<string | null>(null);

  // Clubs list
  const allClubs = Array.from(new Set(players.map(p => p.club?.trim()).filter(Boolean))).sort();
  // Events list
  const allEvents = Array.from(new Set(players.map(p => p.event?.trim()).filter(Boolean))).sort();

  // Combine players & staff if selected
  const baseList: Player[] = includeStaff
    ? [
        ...players,
        ...staffPasses.map(sp => ({
          ...sp,
          ageGroup: 'STAFF',
          gender: '',
          weightClass: '',
          dob: '',
          poomsaePattern: '',
          ic: '',
          photo: sp.photo || ''
        } as unknown as Player))
      ]
    : players;

  // Apply filters
  const filteredAthletes = baseList.filter(p => {
    if (selectedClub !== 'all' && (p.club || '').trim().toLowerCase() !== selectedClub.toLowerCase()) {
      return false;
    }
    if (selectedEvent !== 'all' && (p.event || '').trim().toLowerCase() !== selectedEvent.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchClub = (p.club || '').toLowerCase().includes(q);
      const matchIc = (p.ic || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchClub && !matchIc) return false;
    }
    return true;
  });

  const fieldsList = getIdCardFields(activeComp);

  const getFontSizePx = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl', defaultVal: string): string => {
    const map: Record<string, string> = {
      'xs': '9px',
      'sm': '11px',
      'base': '13px',
      'lg': '16px',
      'xl': '20px',
      '2xl': '24px',
      '3xl': '28px'
    };
    return map[size] || defaultVal;
  };

  // Safe capture single card
  const captureCardElement = async (element: HTMLElement): Promise<string> => {
    return await htmlToImage.toPng(element, {
      backgroundColor: '#12211C',
      pixelRatio: 2, // High resolution (672x960) without exhausting browser RAM
      skipFonts: true, // Prevents CORS errors on external web fonts
      cacheBust: true,
    });
  };

  // Download single card
  const handleDownloadSingleCard = async (player: Player) => {
    setDownloadingCardId(player.id);
    try {
      const el = document.getElementById(`print-preview-card-${player.id}`);
      if (!el) {
        triggerMsg('Could not find card element to download.', 'error');
        return;
      }
      const dataUrl = await captureCardElement(el);
      const link = document.createElement('a');
      const cleanName = player.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `ID_${player.id}_${cleanName}.png`;
      link.href = dataUrl;
      link.click();
      triggerMsg(`Downloaded ID card for ${player.name}.`, 'ok');
    } catch (err) {
      console.error('Single card export error:', err);
      triggerMsg('Failed to export ID card.', 'error');
    } finally {
      setDownloadingCardId(null);
    }
  };

  // Batch download selected cards as ZIP
  const handleBatchDownloadZip = async () => {
    if (filteredAthletes.length === 0) {
      triggerMsg('No ID cards match the current filter.', 'error');
      return;
    }

    setIsGeneratingZip(true);
    setProgressCount(0);
    setProgressTotal(filteredAthletes.length);
    cancelZipRef.current = false;

    const zip = new JSZip();
    const folderName = `${(activeComp.name || 'Tournament').replace(/[^a-zA-Z0-9_-]/g, '_')}_${selectedClub !== 'all' ? selectedClub.replace(/[^a-zA-Z0-9_-]/g, '_') : 'ID_Cards'}`;
    const imgFolder = zip.folder(folderName);

    let successCount = 0;

    for (let i = 0; i < filteredAthletes.length; i++) {
      if (cancelZipRef.current) {
        triggerMsg('ZIP generation canceled.', 'error');
        setIsGeneratingZip(false);
        return;
      }

      const p = filteredAthletes[i];
      setProgressCount(i + 1);

      const el = document.getElementById(`print-preview-card-${p.id}`);
      if (el) {
        try {
          const dataUrl = await captureCardElement(el);
          const base64Data = dataUrl.split(',')[1];
          if (base64Data && imgFolder) {
            const cleanName = p.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            imgFolder.file(`ID_${p.id}_${cleanName}.png`, base64Data, { base64: true });
            successCount++;
          }
        } catch (err) {
          console.warn(`Card render warning for ${p.name}:`, err);
        }
      }

      // Small async tick to keep the UI smooth and responsive
      if (i % 3 === 0) {
        await new Promise(r => setTimeout(r, 15));
      }
    }

    if (successCount === 0) {
      triggerMsg('No cards were successfully generated for download.', 'error');
      setIsGeneratingZip(false);
      return;
    }

    try {
      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      const link = document.createElement('a');
      link.download = `${folderName}.zip`;
      link.href = URL.createObjectURL(content);
      link.click();
      triggerMsg(`Successfully exported ${successCount} ID cards into "${folderName}.zip"!`, 'ok');
    } catch (err) {
      console.error('ZIP package error:', err);
      triggerMsg('Failed to package cards into ZIP. Try downloading by specific Club.', 'error');
    } finally {
      setIsGeneratingZip(false);
    }
  };

  // Native Print / Save to PDF
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      {/* Inject Print Stylesheet for clean multi-page A4 badge printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-cards-modal-area, #print-cards-modal-area * {
            visibility: visible !important;
          }
          #print-cards-modal-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-sheet-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8mm !important;
            background: transparent !important;
          }
          .print-badge-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 6mm !important;
            border: 1px solid #333 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div 
        id="print-cards-modal-area"
        className="bg-surface border border-line rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in"
      >
        {/* MODAL HEADER (hidden on print) */}
        <div className="p-4 sm:p-5 border-b border-line bg-surface-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 no-print">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-gold">
                <Printer className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-text uppercase tracking-wider">
                Print & Download ID Cards
              </h3>
            </div>
            <p className="text-xs text-text-dim mt-0.5">
              {activeComp.name} · <span className="text-gold font-bold">{filteredAthletes.length}</span> of {baseList.length} ID Cards Selected
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isGeneratingZip}
              className="p-1.5 text-text-dim hover:text-text hover:bg-surface rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PROGRESS BANNER IF GENERATING ZIP */}
        {isGeneratingZip && (
          <div className="bg-gold/10 border-b border-gold/30 p-3 px-5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shrink-0 no-print">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <RefreshCw className="w-4 h-4 text-gold animate-spin shrink-0" />
              <div className="space-y-0.5 flex-1">
                <div className="text-xs font-bold text-gold">
                  Generating ID Cards ZIP: {progressCount} of {progressTotal} cards ({Math.round((progressCount / progressTotal) * 100)}%)
                </div>
                <div className="w-full sm:w-64 bg-ink/60 h-2 rounded-full overflow-hidden border border-gold/20">
                  <div 
                    className="bg-gold h-full transition-all duration-150 rounded-full"
                    style={{ width: `${(progressCount / progressTotal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { cancelZipRef.current = true; }}
              className="text-xs font-bold text-red-400 hover:text-red-300 border border-red-500/40 bg-red-950/40 px-3 py-1 rounded-lg transition cursor-pointer shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {/* TOOLBAR CONTROLS (hidden on print) */}
        <div className="p-3 sm:p-4 bg-ink/40 border-b border-line flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0 no-print">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Club Filter */}
            <div className="flex items-center gap-1.5 bg-surface border border-line rounded-xl px-2.5 py-1.5 text-xs text-text min-w-[180px]">
              <Filter className="w-3.5 h-3.5 text-gold shrink-0" />
              <select
                value={selectedClub}
                onChange={(e) => setSelectedClub(e.target.value)}
                className="bg-transparent text-xs text-text outline-none font-medium w-full cursor-pointer"
              >
                <option value="all">All Clubs ({players.length})</option>
                {allClubs.map(c => {
                  const count = players.filter(p => p.club === c).length;
                  return (
                    <option key={c} value={c}>{c} ({count})</option>
                  );
                })}
              </select>
            </div>

            {/* Event Filter */}
            <div className="flex items-center gap-1.5 bg-surface border border-line rounded-xl px-2.5 py-1.5 text-xs text-text min-w-[160px]">
              <span className="text-gold font-bold text-[10px] uppercase">Event:</span>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="bg-transparent text-xs text-text outline-none font-medium w-full cursor-pointer"
              >
                <option value="all">All Disciplines</option>
                {allEvents.map(ev => {
                  const count = players.filter(p => p.event === ev).length;
                  return (
                    <option key={ev} value={ev}>{ev} ({count})</option>
                  );
                })}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[150px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search athlete, IC or ID..."
                className="w-full bg-surface border border-line rounded-xl py-1.5 pl-8 pr-3 text-xs text-text placeholder-text-dim outline-none focus:border-gold"
              />
              <Search className="w-3.5 h-3.5 text-text-dim absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Include Staff toggle */}
            {staffPasses.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-text-dim cursor-pointer px-2 py-1 hover:text-text">
                <input
                  type="checkbox"
                  checked={includeStaff}
                  onChange={(e) => setIncludeStaff(e.target.checked)}
                  className="rounded border-line text-gold focus:ring-gold"
                />
                <span>Include Staff Passes ({staffPasses.length})</span>
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Print to PDF */}
            <button
              type="button"
              onClick={handleTriggerPrint}
              disabled={isGeneratingZip || filteredAthletes.length === 0}
              className="bg-surface-2 hover:bg-line text-text border border-line px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="Open browser print dialog to print or save all as PDF"
            >
              <Printer className="w-4 h-4 text-gold" />
              <span>Print to PDF / Printer</span>
            </button>

            {/* Download ZIP */}
            <button
              type="button"
              onClick={handleBatchDownloadZip}
              disabled={isGeneratingZip || filteredAthletes.length === 0}
              className="bg-gold hover:bg-yellow-400 text-ink px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="Download selected cards as a ZIP of PNG images"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingZip ? 'Generating...' : `Download ZIP (${filteredAthletes.length})`}</span>
            </button>
          </div>
        </div>

        {/* CARDS PREVIEW GRID / PRINT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface/50">
          {filteredAthletes.length === 0 ? (
            <div className="p-12 text-center text-text-dim space-y-2 border border-dashed border-line rounded-2xl">
              <User className="w-10 h-10 text-text-dim/40 mx-auto" />
              <p className="text-sm font-semibold text-text">No athletes match the current filter.</p>
              <p className="text-xs">Adjust your club selection or clear your search query above.</p>
            </div>
          ) : (
            <div className="print-sheet-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
              {filteredAthletes.map((p, idx) => {
                const belt = beltColorFor(p.ageGroup || '');

                return (
                  <div 
                    key={p.id}
                    className="print-badge-item flex flex-col items-center gap-2 group"
                  >
                    {/* ID BADGE CARD (Matches exact design dimensions) */}
                    <div
                      id={`print-preview-card-${p.id}`}
                      className="w-[336px] h-[480px] bg-gradient-to-br from-[#12211C] to-[#0A1310] border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-between shrink-0"
                    >
                      {activeComp.idCardBgUrl && (
                        <>
                          <div 
                            className="absolute inset-0 z-0 bg-cover bg-center" 
                            style={{ backgroundImage: `url(${activeComp.idCardBgUrl})` }} 
                          />
                          <div className="absolute inset-0 z-0 bg-black/40 mix-blend-multiply" />
                        </>
                      )}

                      <div className="relative z-10 h-full flex flex-col justify-between text-[11px] py-3">
                        {fieldsList.filter(f => f.visible).map(field => {
                          if (field.id === 'header') {
                            return (
                              <div 
                                key="header" 
                                className={`h-8 bg-gradient-to-r from-[#D32F2F] via-[#D32F2F] to-[#1976D2] flex ${
                                  field.align === 'left' ? 'justify-start gap-1.5' :
                                  field.align === 'right' ? 'justify-end gap-1.5' :
                                  field.align === 'center' ? 'justify-center gap-1.5' :
                                  'justify-between'
                                } items-center px-3.5 shrink-0 shadow-sm w-full`}
                              >
                                <span 
                                  className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" 
                                  style={{ 
                                    fontSize: (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') 
                                      ? `${parseInt(getFontSizePx(field.fontSize, '8px'), 10) + 3}px` 
                                      : getFontSizePx(field.fontSize, '8px'), 
                                    color: field.color || '#ffffff' 
                                  }}
                                >
                                  {activeComp.name}
                                </span>
                              </div>
                            );
                          }
                          if (field.id === 'belt') {
                            return (
                              <div key="belt" className="h-1.5 w-full shrink-0" style={{ backgroundColor: belt }}></div>
                            );
                          }

                          return (
                            <div key={field.id} className="px-4.5 py-1 shrink-0">
                              {(() => {
                                if (field.id === 'photo') {
                                  return (
                                    <div className={`flex ${
                                      field.align === 'left' ? 'justify-start' :
                                      field.align === 'right' ? 'justify-end' :
                                      'justify-center'
                                    }`}>
                                      <div className="w-[105px] h-[135px] bg-slate-900 border-[3px] border-white/20 shadow-xl overflow-hidden relative rounded-xl">
                                        {p.photo ? (
                                          <img 
                                            src={p.photo} 
                                            alt={p.name} 
                                            className="w-full h-full object-cover" 
                                            crossOrigin="anonymous"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center opacity-30">
                                            <User className="w-12 h-12 text-white" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                if (field.id === 'name') {
                                  return (
                                    <div className={
                                      field.align === 'left' ? 'text-left' :
                                      field.align === 'right' ? 'text-right' :
                                      'text-center'
                                    }>
                                      <h3 
                                        className="font-display font-bold leading-tight tracking-wide uppercase line-clamp-2" 
                                        style={{ 
                                          fontSize: getFontSizePx(field.fontSize, '12px'), 
                                          color: field.color || '#ffffff' 
                                        }}
                                      >
                                        {p.name}
                                      </h3>
                                    </div>
                                  );
                                }
                                if (field.id === 'club') {
                                  return (
                                    <div className={
                                      field.align === 'left' ? 'text-left' :
                                      field.align === 'right' ? 'text-right' :
                                      'text-center'
                                    }>
                                      <p 
                                        className="uppercase tracking-widest font-semibold" 
                                        style={{ 
                                          fontSize: getFontSizePx(field.fontSize, '8px'), 
                                          color: field.color || '#a0aec0' 
                                        }}
                                      >
                                        {p.club}
                                      </p>
                                    </div>
                                  );
                                }
                                if (field.id === 'athleteId') {
                                  if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') return null;
                                  return (
                                    <div className={
                                      field.align === 'left' ? 'text-left' :
                                      field.align === 'right' ? 'text-right' :
                                      'text-center'
                                    }>
                                      <span 
                                        className="inline-block bg-surface border border-line font-mono px-1.5 py-0.5 rounded font-bold" 
                                        style={{ 
                                          fontSize: getFontSizePx(field.fontSize, '8px'), 
                                          color: field.color || '#D4AF37' 
                                        }}
                                      >
                                        {p.id}
                                      </span>
                                    </div>
                                  );
                                }
                                if (field.id === 'metadata') {
                                  if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') {
                                    return (
                                      <div key="metadata" className="px-4 py-1 shrink-0 flex items-center justify-center border-t border-line/30 pt-4 pb-2">
                                        <span 
                                          className="font-display font-bold tracking-widest uppercase text-white" 
                                          style={{ 
                                            fontSize: `${parseInt(getFontSizePx(field.fontSize, '20px'), 10) + 10}px`, 
                                            color: field.color || '#ffffff' 
                                          }}
                                        >
                                          {p.event}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className={`grid grid-cols-2 gap-2 text-[9px] border-t border-line/30 pt-2 ${
                                      field.align === 'left' ? 'text-left' :
                                      field.align === 'right' ? 'text-right' :
                                      'text-center'
                                    }`}>
                                      <div>
                                        <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Category</span>
                                        <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.ageGroup}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                                        <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.gender}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold font-sans">Weight</span>
                                        <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.weightClass}{p.poomsaePattern ? ` / ${p.poomsaePattern}` : ''}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                                        <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.dob}</span>
                                      </div>
                                    </div>
                                  );
                                }
                                if (field.id === 'qrcode') {
                                  const containerClass = 
                                    field.align === 'right' ? 'flex flex-row-reverse items-center justify-between' :
                                    field.align === 'center' ? 'flex flex-col items-center justify-center gap-1.5 text-center' :
                                    'flex items-center justify-between';
                                  
                                  const textAlignmentClass = 
                                    field.align === 'right' ? 'text-left min-w-0' :
                                    field.align === 'center' ? 'text-center min-w-0' :
                                    'text-right min-w-0';

                                  return (
                                    <div className={`${containerClass} border-t border-dashed border-line/30 pt-2`}>
                                      <div className="bg-white p-0.5 rounded inline-block shadow shrink-0">
                                        <QRCodeSVG 
                                          value={`${activeComp.id}::${p.id}`} 
                                          size={32} 
                                          level="M" 
                                          includeMargin={false}
                                        />
                                      </div>
                                      <div className={textAlignmentClass}>
                                        {!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && (
                                          <p className="font-display font-bold uppercase tracking-wider bg-slate-950/30 px-1.5 py-0.5 rounded border border-white/10 text-white inline-block mb-1" style={{ fontSize: getFontSizePx(field.fontSize, '8px') }}>
                                            {p.event}
                                          </p>
                                        )}
                                        <p className="font-display font-bold uppercase tracking-wider" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                                        <p className="mt-0.5 leading-normal text-[6px]" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: field.color || '#a0aec0', opacity: 0.85 }}>Scan to verify athlete</p>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Single Download button below each card preview (hidden on print) */}
                    <div className="flex items-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => handleDownloadSingleCard(p)}
                        disabled={downloadingCardId === p.id}
                        className="bg-surface border border-line hover:border-gold px-3 py-1 rounded-lg text-[10px] font-bold text-text hover:text-gold transition cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        {downloadingCardId === p.id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-gold" />
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3 text-gold" />
                            <span>Download PNG</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL FOOTER (hidden on print) */}
        <div className="p-3 sm:p-4 bg-surface-2 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-dim no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text">{filteredAthletes.length}</span> cards ready for printing & export.
            {selectedClub !== 'all' && (
              <span className="text-gold font-medium">Filtered by: {selectedClub}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-ink border border-line text-text hover:border-gold px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleTriggerPrint}
              disabled={filteredAthletes.length === 0}
              className="bg-surface-2 hover:bg-line text-text border border-line px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4 text-gold" />
              <span>Print to PDF</span>
            </button>
            <button
              type="button"
              onClick={handleBatchDownloadZip}
              disabled={isGeneratingZip || filteredAthletes.length === 0}
              className="bg-gold hover:bg-yellow-400 text-ink px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP ({filteredAthletes.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
