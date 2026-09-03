import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""                        const label = getEventWeightClassLabel\(ev\);\n                        return \(\n                          <div key=\{ev\} className="bg-surface border border-line rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2\.5 hover:border-line-hover transition">\n                            <div className="min-w-\[160px\] shrink-0">\n                              <span className="text-xs font-bold text-text flex items-center gap-1\.5">\n                                <span className="w-2 h-2 rounded-full bg-gold"></span>\n                                \{ev\}\n                              </span>\n                              <span className="text-\[10px\] text-text-dim block mt-0\.5">\{label\}</span>\n                            </div>\n                            <div className="flex-1 w-full sm:w-auto">\n                              <select \n                                value=\{currentVal\}\n                                onChange=\{\(e\) => \{\n                                  const val = e\.target\.value;\n                                  setPEventWeightClasses\(prev => \(\{ \.\.\.prev, \[ev\]: val \}\)\);\n                                  if \(ev === effectiveEvents\[0\]\) \{\n                                    setPWeightClass\(val\);\n                                  \}\n                                \}\}\n                                className="w-full bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition font-medium"\n                              >\n                                \{wcList\.length === 0 \? \(\n                                  <option value="">No divisions defined for \{ev\}</option>\n                                \) : \(\n                                  wcList\.map\(wc => \(\n                                    <option key=\{wc\} value=\{wc\}>\{wc\}</option>\n                                  \)\)\n                                \)\}\n                              </select>\n                            </div>\n                          </div>\n                        \);""")

replacement = r"""                        const label = getEventWeightClassLabel(ev);
                        const isPoomsae = ev.toLowerCase().includes('poomsae');
                        const currentPattern = pEventPoomsaePatterns[ev] || '';
                        
                        return (
                          <div key={ev} className="bg-surface border border-line rounded-xl p-3 flex flex-col gap-2.5 hover:border-line-hover transition">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="min-w-[160px] shrink-0">
                                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-gold"></span>
                                  {ev}
                                </span>
                                <span className="text-[10px] text-text-dim block mt-0.5">{label}</span>
                              </div>
                              <div className="flex-1 w-full sm:w-auto">
                                <select 
                                  value={currentVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPEventWeightClasses(prev => ({ ...prev, [ev]: val }));
                                    if (ev === effectiveEvents[0]) {
                                      setPWeightClass(val);
                                    }
                                  }}
                                  className="w-full bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition font-medium"
                                >
                                  {wcList.length === 0 ? (
                                    <option value="">No divisions defined for {ev}</option>
                                  ) : (
                                    wcList.map(wc => (
                                      <option key={wc} value={wc}>{wc}</option>
                                    ))
                                  )}
                                </select>
                              </div>
                            </div>
                            
                            {isPoomsae && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-2 pt-2 border-t border-line/40">
                                <div className="min-w-[160px] shrink-0">
                                  <span className="text-[10px] text-text-dim block uppercase font-bold tracking-wide">Poomsae Pattern</span>
                                </div>
                                <div className="flex-1 w-full sm:w-auto">
                                  <select
                                    value={currentPattern}
                                    onChange={(e) => setPEventPoomsaePatterns(prev => ({ ...prev, [ev]: e.target.value }))}
                                    className="w-full bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition font-medium"
                                  >
                                    <option value="">-- Select Pattern (Optional) --</option>
                                    {POOMSAE_PATTERNS.map(pattern => (
                                      <option key={pattern} value={pattern}>{pattern}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        );"""

content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
