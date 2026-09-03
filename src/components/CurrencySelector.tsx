import React, { useState, useRef, useEffect } from 'react';
import { Coins, ChevronDown, Check } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '../utils';

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  label?: string;
  compact?: boolean;
  className?: string;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  value,
  onChange,
  label = 'Currency',
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCurrency = value?.trim() || 'RM';
  const matchedOption = SUPPORTED_CURRENCIES.find(
    (c) => c.symbol.toUpperCase() === selectedCurrency.toUpperCase() || c.code.toUpperCase() === selectedCurrency.toUpperCase()
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbol: string) => {
    onChange(symbol);
    setIsCustomMode(false);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    const trimmed = customVal.trim();
    if (trimmed) {
      onChange(trimmed);
      setIsOpen(false);
    }
  };

  if (compact) {
    return (
      <div className={`relative inline-block ${className}`} ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-ink/70 hover:bg-ink border border-gold/40 hover:border-gold text-gold px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          title="Select Tournament Currency"
        >
          <Coins className="w-3.5 h-3.5 text-gold shrink-0" />
          <span className="font-mono">{selectedCurrency}</span>
          <ChevronDown className="w-3 h-3 text-gold/70 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-60 bg-[#1a202c] border border-line rounded-2xl shadow-2xl p-2 z-50 animate-scale-up">
            <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider px-2 py-1 mb-1">
              Select Currency
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
              {SUPPORTED_CURRENCIES.map((curr) => {
                const isSelected =
                  selectedCurrency.toUpperCase() === curr.symbol.toUpperCase() ||
                  selectedCurrency.toUpperCase() === curr.code.toUpperCase();
                return (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => handleSelect(curr.symbol)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-gold/20 text-gold font-bold'
                        : 'text-text hover:bg-surface-2 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold w-7 text-gold shrink-0">{curr.symbol}</span>
                      <span className="text-[11px] truncate text-text-dim">{curr.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-gold shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 pt-2 border-t border-line/60">
              <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider px-2 mb-1.5">
                Custom Currency
              </div>
              <div className="flex gap-1.5 px-1">
                <input
                  type="text"
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyCustom();
                  }}
                  placeholder="e.g. NZD, AED"
                  className="w-full bg-ink border border-line rounded-lg px-2 py-1 text-xs text-text placeholder-text-dim font-mono focus:outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="bg-gold hover:opacity-90 text-ink px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-gold" />
            {label}
          </span>
          <span className="font-mono font-bold text-gold text-[11px]">
            Selected: {selectedCurrency}
          </span>
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-ink border border-line hover:border-gold/50 text-sm rounded-xl py-2 px-3 text-text flex items-center justify-between transition cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-lg border border-gold/30">
              {selectedCurrency}
            </span>
            <span className="text-xs text-text-dim truncate">
              {matchedOption ? matchedOption.label : `${selectedCurrency} (Custom)`}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-text-dim shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-[#1a202c] border border-line rounded-2xl shadow-2xl p-2.5 z-50 animate-scale-up">
            <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider px-2 py-1 mb-1">
              Select Official Currency
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
              {SUPPORTED_CURRENCIES.map((curr) => {
                const isSelected =
                  selectedCurrency.toUpperCase() === curr.symbol.toUpperCase() ||
                  selectedCurrency.toUpperCase() === curr.code.toUpperCase();
                return (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => handleSelect(curr.symbol)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-gold/20 text-gold font-bold'
                        : 'text-text hover:bg-surface-2 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="font-mono font-bold w-9 text-gold shrink-0">{curr.symbol}</span>
                      <span className="text-xs text-text-dim truncate">{curr.label}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-gold shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-line/60">
              <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider px-2 mb-1.5">
                Custom Currency Code or Symbol
              </div>
              <div className="flex gap-2 px-1">
                <input
                  type="text"
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyCustom();
                  }}
                  placeholder="Enter currency (e.g. NZD, AED, CHF)"
                  className="w-full bg-ink border border-line rounded-xl px-3 py-1.5 text-xs text-text placeholder-text-dim font-mono focus:outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="bg-gold hover:opacity-90 text-ink px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
