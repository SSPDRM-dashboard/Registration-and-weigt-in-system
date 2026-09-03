import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""                  const label = getEventWeightClassLabel\(singleEv\);\n\n                  return \(\n                    <div className="space-y-1\.5">\n                      <div className="flex justify-between items-center">\n                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest">\n                          \{label\} \*\n                        </label>\n                        <span className="text-\[10px\] text-gold font-bold bg-gold/10 border border-gold/20 px-2 py-0\.5 rounded-full">\n                          \{singleEv\}\n                        </span>\n                      </div>\n                      <select \n                        value=\{currentSelectedWc\}\n                        onChange=\{\(e\) => \{\n                          const val = e\.target\.value;\n                          setPWeightClass\(val\);\n                          setPEventWeightClasses\(prev => \(\{ \.\.\.prev, \[singleEv\]: val \}\)\);\n                        \}\}\n                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition font-medium"\n                      >\n                        \{wcList\.length === 0 \? \(\n                          <option value="">No divisions defined for \{singleEv\}</option>\n                        \) : \(\n                          wcList\.map\(wc => \(\n                            <option key=\{wc\} value=\{wc\}>\{wc\}</option>\n                          \)\)\n                        \}\}\n                      </select>\n                      <p className="text-\[11px\] text-text-dim">\n                        Target division configured specifically for the <strong className="text-text font-medium">\{singleEv\}</strong> discipline\.\n                      </p>\n                    </div>\n                  \);""")

replacement = r"""                  const label = getEventWeightClassLabel(singleEv);
                  const isPoomsae = singleEv.toLowerCase().includes('poomsae');
                  const currentPattern = pEventPoomsaePatterns[singleEv] || '';

                  return (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest">
                            {label} *
                          </label>
                          <span className="text-[10px] text-gold font-bold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                            {singleEv}
                          </span>
                        </div>
                        <select 
                          value={currentSelectedWc}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPWeightClass(val);
                            setPEventWeightClasses(prev => ({ ...prev, [singleEv]: val }));
                          }}
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition font-medium"
                        >
                          {wcList.length === 0 ? (
                            <option value="">No divisions defined for {singleEv}</option>
                          ) : (
                            wcList.map(wc => (
                              <option key={wc} value={wc}>{wc}</option>
                            ))
                          )}
                        </select>
                        <p className="text-[11px] text-text-dim">
                          Target division configured specifically for the <strong className="text-text font-medium">{singleEv}</strong> discipline.
                        </p>
                      </div>
                      
                      {isPoomsae && (
                        <div className="space-y-1.5 pt-2 border-t border-line/40">
                          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest">
                            Poomsae Pattern (Optional)
                          </label>
                          <select
                            value={currentPattern}
                            onChange={(e) => setPEventPoomsaePatterns(prev => ({ ...prev, [singleEv]: e.target.value }))}
                            className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition font-medium"
                          >
                            <option value="">-- Select Pattern --</option>
                            {POOMSAE_PATTERNS.map(pattern => (
                              <option key={pattern} value={pattern}>{pattern}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );"""

content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
