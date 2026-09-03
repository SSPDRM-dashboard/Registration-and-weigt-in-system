import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, AlertCircle, FileText, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';

interface AgeGroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  compName?: string;
  photoUrl?: string;
  ageGroups?: string[];
  onUploadPhoto?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto?: () => void;
  canManage?: boolean;
}

export const AgeGroupDetailsModal: React.FC<AgeGroupDetailsModalProps> = ({
  isOpen,
  onClose,
  compName,
  photoUrl,
  ageGroups = [],
  onUploadPhoto,
  onRemovePhoto,
  canManage = false,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-text uppercase tracking-wider">
                Age Group Category Specifications
              </h2>
              <p className="text-xs text-text-dim">
                {compName ? `${compName} · ` : ''}Official Division & Birth Year Chart
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {photoUrl ? (
            <div className="space-y-3">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-ink/50 border border-line px-3 py-2 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-text-dim font-medium">Zoom:</span>
                  <button
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 0.75}
                    className="p-1.5 hover:bg-surface-2 border border-line/50 rounded-lg text-text disabled:opacity-40 transition cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="px-2 py-1 hover:bg-surface-2 border border-line/50 rounded-lg text-text text-[11px] font-medium transition cursor-pointer"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 2.5}
                    className="p-1.5 hover:bg-surface-2 border border-line/50 rounded-lg text-text disabled:opacity-40 transition cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {canManage && onUploadPhoto && (
                    <label className="bg-surface hover:bg-surface-2 border border-line px-3 py-1.5 rounded-lg text-text font-semibold flex items-center gap-1.5 transition text-xs cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-gold" />
                      <span>Replace Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onUploadPhoto}
                      />
                    </label>
                  )}
                  {canManage && onRemovePhoto && (
                    <button
                      type="button"
                      onClick={onRemovePhoto}
                      className="bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 text-red-400 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition text-xs cursor-pointer"
                      title="Delete Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                  <a
                    href={photoUrl}
                    download="age-group-details.png"
                    className="bg-surface hover:bg-surface-2 border border-line px-3 py-1.5 rounded-lg text-text font-semibold flex items-center gap-1.5 transition text-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-gold" />
                    <span>Download Chart</span>
                  </a>
                </div>
              </div>

              {/* Photo Display Frame */}
              <div className="bg-ink/80 rounded-2xl border border-line p-2 overflow-auto flex items-center justify-center min-h-[340px] max-h-[60vh]">
                <img
                  src={photoUrl}
                  alt="Age Group Category Specifications"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                  className="max-w-full h-auto object-contain rounded-lg transition-transform duration-150"
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-12 px-4 space-y-4 bg-ink/30 border border-line/50 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-line flex items-center justify-center mx-auto text-text-dim">
                <AlertCircle className="w-7 h-7 text-gold/80" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-sm font-bold text-text uppercase tracking-wide">
                  No Age Group Chart Uploaded Yet
                </h3>
                <p className="text-xs text-text-dim leading-relaxed">
                  Upload an image of the official Age Group Category breakdown, birth year matrix, or guidelines poster so coaches can reference it when registering athletes.
                </p>
              </div>
              {canManage && onUploadPhoto && (
                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 bg-gold hover:opacity-90 text-ink font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-md transition">
                    <Upload className="w-4 h-4" />
                    <span>Upload Age Group Chart Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onUploadPhoto}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Fallback/Accompanying text list of categories */}
          {ageGroups.length > 0 && (
            <div className="bg-ink/40 border border-line rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-text uppercase tracking-wider">
                <FileText className="w-4 h-4 text-gold" />
                <span>Configured Tournament Age Brackets ({ageGroups.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {ageGroups.map((ag, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] bg-surface border border-line px-2.5 py-1 rounded-lg text-text font-medium"
                  >
                    {ag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-2/40 flex justify-between items-center">
          {canManage && !photoUrl && onUploadPhoto ? (
            <label className="text-xs text-gold hover:underline flex items-center gap-1.5 cursor-pointer font-medium">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload photo now</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUploadPhoto}
              />
            </label>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gold hover:bg-gold/90 text-ink font-bold text-xs transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
