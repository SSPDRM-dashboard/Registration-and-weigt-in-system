const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace 1: Organizer table headers (around line 5155)
code = code.replace(
  '<th className="p-4">Weigh-In Scale status</th>\n                        <th className="p-4 text-right">Actions</th>',
  '<th className="p-4">Weigh-In Scale status</th>\n                        <th className="p-4 text-center">Signature</th>\n                        <th className="p-4 text-right">Actions</th>'
);

// Replace 2: Admin/Organizer table cells
const targetCell = `<td className="p-4 text-text-dim">{p.weightClass}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {renderBadge(p.weighIn?.result)}
                              {p.weighIn && <span className="text-[10px] text-text-dim">Scale Readout: {p.weighIn.weight}kg</span>}
                            </div>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">`;

const replacementCell = `<td className="p-4 text-text-dim">{p.weightClass}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {renderBadge(p.weighIn?.result)}
                              {p.weighIn && <span className="text-[10px] text-text-dim">Scale Readout: {p.weighIn.weight}kg</span>}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {p.weighIn?.signature ? (
                              <img src={p.weighIn.signature} alt="Signature" className="h-8 inline-block bg-white rounded px-1 object-contain border border-line" />
                            ) : (
                              <span className="text-[10px] text-text-dim/50 italic">No signature</span>
                            )}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">`;

code = code.split(targetCell).join(replacementCell);

fs.writeFileSync('src/App.tsx', code);
