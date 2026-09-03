import React from 'react';
import { X, Download } from 'lucide-react';
import { ClubReceipt } from '../../types';

interface PaymentReceiptModalProps {
  selectedClubReceipt: ClubReceipt | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  selectedClubReceipt,
  onClose,
}) => {
  if (!selectedClubReceipt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-line">
          <div>
            <h3 className="text-sm font-bold text-text uppercase tracking-wider">
              {selectedClubReceipt.clubName} Payment Receipt
            </h3>
            <p className="text-[10px] text-text-dim uppercase tracking-wider">
              Uploaded at {selectedClubReceipt.uploadedAt}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text bg-line/20 hover:bg-line/40 p-1.5 rounded-full transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 bg-ink/40 rounded-2xl p-2 border border-line/50 flex items-center justify-center min-h-[300px] max-h-[500px] overflow-y-auto">
          <img
            src={selectedClubReceipt.receiptUrl}
            alt="Payment Receipt"
            className="max-w-full max-h-[480px] object-contain rounded-lg"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a
            href={selectedClubReceipt.receiptUrl}
            download={`Receipt-${selectedClubReceipt.clubName.replace(/\s+/g, '-')}.png`}
            className="bg-gold text-ink hover:opacity-90 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download File</span>
          </a>
          <button
            onClick={onClose}
            className="bg-ink text-text-dim border border-line hover:text-text px-4 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
