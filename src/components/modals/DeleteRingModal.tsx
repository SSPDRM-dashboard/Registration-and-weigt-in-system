import React from 'react';
import { Trash2, X } from 'lucide-react';
import { Referee } from '../../types';

interface DeleteRingModalProps {
  ringToDelete: string | null;
  onClose: () => void;
  referees: Referee[];
  onConfirmDelete: (ringName: string) => void;
}

export const DeleteRingModal: React.FC<DeleteRingModalProps> = ({
  ringToDelete,
  onClose,
  referees,
  onConfirmDelete,
}) => {
  if (!ringToDelete) return null;

  const assignedCount = referees.filter(
    r => r.courtAssignment === ringToDelete && r.courtAssignment !== 'Unassigned'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        <div className="p-5 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            Remove {ringToDelete}
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-white transition p-1.5 hover:bg-surface-2 rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-bold text-base text-text">Are you sure you want to delete {ringToDelete}?</h3>
            {assignedCount > 0 ? (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 leading-relaxed">
                <strong>{assignedCount} assigned referee(s)</strong> will be automatically released back to the available referee pool.
              </p>
            ) : (
              <p className="text-xs text-text-dim leading-relaxed">
                This ring will be removed from all tournament matches, RIC assignment panels, and live arena display boards.
              </p>
            )}
          </div>
        </div>
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
            onClick={() => onConfirmDelete(ringToDelete)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete {ringToDelete}
          </button>
        </div>
      </div>
    </div>
  );
};
