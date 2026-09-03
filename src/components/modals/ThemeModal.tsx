import React from 'react';
import { Palette, X, Sun, Sliders, Layout, Trophy, User, QrCode, CheckCircle, Scale } from 'lucide-react';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'emerald' | 'midnight' | 'crimson' | 'zen';
  setTheme: (theme: 'emerald' | 'midnight' | 'crimson' | 'zen') => void;
  layoutDensity: 'bento' | 'compact';
  setLayoutDensity: (density: 'bento' | 'compact') => void;
  layoutWidth: 'standard' | 'widescreen' | 'fluid';
  setLayoutWidth: (width: 'standard' | 'widescreen' | 'fluid') => void;
  customBgColor: string;
  setCustomBgColor: (color: string) => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  layoutDensity,
  setLayoutDensity,
  layoutWidth,
  setLayoutWidth,
  customBgColor,
  setCustomBgColor,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in print:hidden">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* LEFT PANEL: THEME SELECTOR & CONTROLS */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto border-b md:border-b-0 md:border-r border-line">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-gold/10 border border-gold/30">
                <Palette className="w-6 h-6 text-gold" />
              </div>
              <div>
                <h3 className="text-xl font-bold uppercase tracking-wider text-text">Theme Station</h3>
                <p className="text-xs text-text-dim mt-0.5">Customize your terminal look & feel</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-text-dim hover:text-hong p-2 rounded-xl hover:bg-surface-2 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gold block mb-3">
                Pre-Engineered Master Themes
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. EMERALD */}
                <button
                  onClick={() => setTheme('emerald')}
                  className={`p-3.5 rounded-2xl border text-left transition duration-200 cursor-pointer flex items-center justify-between ${
                    theme === 'emerald'
                      ? 'bg-gold/10 border-gold shadow-md'
                      : 'bg-surface-2 border-line hover:border-text-dim'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#10b981]"></div>
                      <span className="font-bold text-xs uppercase text-text">Emerald Prestige</span>
                    </div>
                    <p className="text-[10px] text-text-dim mt-1">Refined forest green & metallic gold</p>
                  </div>
                  {theme === 'emerald' && <span className="text-[10px] font-bold text-gold uppercase">Active</span>}
                </button>

                {/* 2. MIDNIGHT */}
                <button
                  onClick={() => setTheme('midnight')}
                  className={`p-3.5 rounded-2xl border text-left transition duration-200 cursor-pointer flex items-center justify-between ${
                    theme === 'midnight'
                      ? 'bg-gold/10 border-gold shadow-md'
                      : 'bg-surface-2 border-line hover:border-text-dim'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#0284c7]"></div>
                      <span className="font-bold text-xs uppercase text-text">Midnight Cobalt</span>
                    </div>
                    <p className="text-[10px] text-text-dim mt-1">Deep ocean navy & vivid sapphire</p>
                  </div>
                  {theme === 'midnight' && <span className="text-[10px] font-bold text-gold uppercase">Active</span>}
                </button>

                {/* 3. CRIMSON */}
                <button
                  onClick={() => setTheme('crimson')}
                  className={`p-3.5 rounded-2xl border text-left transition duration-200 cursor-pointer flex items-center justify-between ${
                    theme === 'crimson'
                      ? 'bg-gold/10 border-gold shadow-md'
                      : 'bg-surface-2 border-line hover:border-text-dim'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#ef4444]"></div>
                      <span className="font-bold text-xs uppercase text-text">Crimson Dynasty</span>
                    </div>
                    <p className="text-[10px] text-text-dim mt-1">Vibrant ruby red & championship gold</p>
                  </div>
                  {theme === 'crimson' && <span className="text-[10px] font-bold text-gold uppercase">Active</span>}
                </button>

                {/* 4. ZEN */}
                <button
                  onClick={() => setTheme('zen')}
                  className={`p-3.5 rounded-2xl border text-left transition duration-200 cursor-pointer flex items-center justify-between ${
                    theme === 'zen'
                      ? 'bg-gold/10 border-gold shadow-md'
                      : 'bg-surface-2 border-line hover:border-text-dim'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#f8fafc] border border-slate-400"></div>
                      <span className="font-bold text-xs uppercase text-text">Zen Daylight</span>
                    </div>
                    <p className="text-[10px] text-text-dim mt-1">Ultra clean light mode for bright sun</p>
                  </div>
                  {theme === 'zen' && <span className="text-[10px] font-bold text-gold uppercase">Active</span>}
                </button>
              </div>
            </div>

            {/* BACKGROUND COLOR ACCENT / WALLPAPER OVERRIDE */}
            <div className="border-t border-line pt-4">
              <label className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5 mb-2">
                <Sun className="w-3.5 h-3.5" />
                <span>Custom Background Ambient Tint</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={customBgColor.startsWith('#') ? customBgColor : '#0f172a'}
                  onChange={(e) => setCustomBgColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-line bg-surface p-1"
                />
                <span className="text-xs font-mono text-text-dim">{customBgColor || 'Default Theme Tint'}</span>
                {customBgColor && (
                  <button
                    onClick={() => setCustomBgColor('')}
                    className="text-[10px] text-hong hover:underline ml-auto font-bold uppercase"
                  >
                    Reset Tint
                  </button>
                )}
              </div>
            </div>

            {/* DENSITY & SIZING */}
            <div className="border-t border-line pt-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5 mb-2">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Card Grid Layout Density</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLayoutDensity('bento')}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center justify-center space-x-2 ${
                      layoutDensity === 'bento'
                        ? 'bg-gold/10 border-gold text-gold shadow-sm'
                        : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                    }`}
                  >
                    <span className="uppercase text-[10px] tracking-wider">Spacious Bento</span>
                  </button>
                  <button
                    onClick={() => setLayoutDensity('compact')}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center justify-center space-x-2 ${
                      layoutDensity === 'compact'
                        ? 'bg-gold/10 border-gold text-gold shadow-sm'
                        : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                    }`}
                  >
                    <span className="uppercase text-[10px] tracking-wider">High Density</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5 mb-2">
                  <Layout className="w-3.5 h-3.5" />
                  <span>Screen Canvas Width</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setLayoutWidth('standard')}
                    className={`px-2 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                      layoutWidth === 'standard'
                        ? 'bg-gold/10 border-gold text-gold shadow-sm'
                        : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                    }`}
                  >
                    <span className="uppercase text-[9px] tracking-wider">Standard</span>
                    <span className="text-[8px] font-normal opacity-75">1280px Grid</span>
                  </button>
                  <button
                    onClick={() => setLayoutWidth('widescreen')}
                    className={`px-2 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                      layoutWidth === 'widescreen'
                        ? 'bg-gold/10 border-gold text-gold shadow-sm'
                        : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                    }`}
                  >
                    <span className="uppercase text-[9px] tracking-wider">Widescreen</span>
                    <span className="text-[8px] font-normal opacity-75">1500px Board</span>
                  </button>
                  <button
                    onClick={() => setLayoutWidth('fluid')}
                    className={`px-2 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                      layoutWidth === 'fluid'
                        ? 'bg-gold/10 border-gold text-gold shadow-sm'
                        : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                    }`}
                  >
                    <span className="uppercase text-[9px] tracking-wider">Fluid</span>
                    <span className="text-[8px] font-normal opacity-75">100% Edge</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line text-center">
            <button
              onClick={onClose}
              className="w-full bg-gold hover:opacity-90 text-ink font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-md transition duration-200 cursor-pointer"
            >
              Apply Personalization
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: IMMERSIVE PREVIEW DECK */}
        <div className="bg-ink p-6 md:p-8 flex-1 flex flex-col justify-center items-center space-y-6 overflow-y-auto">
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-widest font-bold text-gold bg-surface px-3 py-1 rounded-full border border-line">
              Immersive Live Preview
            </span>
            <p className="text-xs text-text-dim mt-2 max-w-xs mx-auto">
              Click any preset on the left to watch all components and the background repaint instantly in real-time!
            </p>
          </div>

          {/* MOCK PLAYER BADGE / ID CARD */}
          <div className="bg-surface border-2 border-line rounded-2xl p-4 w-full max-w-[280px] shadow-lg relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1.5 flex">
              <div className="bg-hong flex-1"></div>
              <div className="bg-chong flex-1"></div>
            </div>
            <div className="flex justify-between items-start mt-2">
              <span className="text-[8px] font-mono font-bold text-gold tracking-wider bg-ink px-1.5 py-0.5 rounded border border-line">
                ID: TMR-PRE-099
              </span>
              <Trophy className="w-4 h-4 text-gold" />
            </div>
            <div className="flex flex-col items-center mt-3 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-line bg-ink overflow-hidden flex items-center justify-center shadow-inner">
                <User className="w-8 h-8 text-text-dim" />
              </div>
              <h3 className="text-xs font-bold uppercase text-text mt-3 tracking-wide">HAZIM LUQMAN</h3>
              <p className="text-[9px] font-semibold text-gold uppercase tracking-wider">Smart Ma Taekwondo</p>
              <div className="w-full h-[1px] bg-line my-2"></div>
              <div className="grid grid-cols-2 gap-1 w-full text-[9px] text-text-dim">
                <div className="text-left">
                  <span>Division:</span>
                  <p className="font-bold text-text uppercase leading-tight">Junior Male</p>
                </div>
                <div className="text-right">
                  <span>Class:</span>
                  <p className="font-bold text-text uppercase leading-tight">Fly -48kg</p>
                </div>
              </div>
              <div className="mt-3 p-1.5 bg-ink rounded-lg border border-line w-full flex justify-between items-center">
                <div className="flex items-center space-x-1.5">
                  <QrCode className="w-5 h-5 text-text" />
                  <div className="text-left leading-none">
                    <span className="text-[7px] text-text-dim block">SCAN STATUS</span>
                    <span className="text-[9px] font-bold text-good">WEIGH-IN PASS</span>
                  </div>
                </div>
                <CheckCircle className="w-3.5 h-3.5 text-good" />
              </div>
            </div>
          </div>

          {/* MOCK LIVE SYSTEM COMPONENTS */}
          <div className="w-full max-w-[280px] space-y-2 text-xs">
            <div className="bg-surface border border-line p-2.5 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-2">
                <Scale className="w-3.5 h-3.5 text-gold" />
                <div>
                  <span className="text-[9px] text-text-dim block">LIVE SCALE READING</span>
                  <span className="font-mono font-bold text-text">47.65 KG</span>
                </div>
              </div>
              <span className="bg-good/15 text-good border border-good/30 text-[9px] uppercase font-bold px-2 py-0.5 rounded-md">
                Pass
              </span>
            </div>
            <div className="bg-surface border border-line p-2.5 rounded-xl space-y-1.5 shadow-sm">
              <label className="text-[9px] font-bold uppercase tracking-wider text-text-dim block">Scale Access Code</label>
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  readOnly
                  value="weighin123"
                  className="flex-1 bg-ink border border-line rounded-lg text-[10px] py-1 px-2 text-text outline-none focus:border-gold"
                />
                <button className="bg-gold text-ink font-bold text-[9px] uppercase px-2.5 py-1 rounded-lg">
                  Log
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
