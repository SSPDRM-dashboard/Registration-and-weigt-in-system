import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""                              \{p\.indemnityStatus === 'Completed' \? \(\n                                <button\n                                  onClick=\{\(\) => \{ setSelectedIndemnityPlayer\(p\); setShowViewIndemnityModal\(true\); \}\}\n                                  className="text-gold hover:underline text-\[10px\] font-semibold flex items-center gap-0\.5 shrink-0 cursor-pointer"\n                                  title="View completed parental indemnity form"\n                                >\n                                  <Eye className="w-3\.5 h-3\.5 text-gold" />\n                                </button>\n                              \)\}""", re.DOTALL)

replacement = r"""                              {p.indemnityStatus === 'Completed' ? (
                                <button
                                  onClick={() => { setSelectedIndemnityPlayer(p); setShowViewIndemnityModal(true); }}
                                  className="text-gold hover:underline text-[10px] font-semibold flex items-center gap-0.5 shrink-0 cursor-pointer"
                                  title="View completed parental indemnity form"
                                >
                                  <Eye className="w-3.5 h-3.5 text-gold" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      const url = `${window.location.origin}${window.location.pathname}?screen=parentIndemnity&athleteId=${p.id}&indemnityComp=${p.compId || activeComp?.id || ''}`;
                                      navigator.clipboard.writeText(url);
                                      triggerMsg(`Indemnity form link copied for ${p.name}!`, 'ok');
                                    }}
                                    className="text-text-dim hover:text-gold text-[10px] font-semibold flex items-center gap-0.5 shrink-0 cursor-pointer"
                                    title="Copy parental indemnity form link"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-text-dim" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenIndemnityForm(p)}
                                    className="text-gold hover:underline text-[10px] font-semibold flex items-center gap-0.5 shrink-0 cursor-pointer ml-1"
                                    title="Open and fill indemnity form for athlete"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-gold" />
                                  </button>
                                </div>
                              )}"""

new_content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(new_content)
