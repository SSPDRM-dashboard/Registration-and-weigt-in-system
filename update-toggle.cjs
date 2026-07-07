const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetHeader = `<th className="p-4">Weigh-In Scale status</th>
                        <th className="p-4 text-center">Signature</th>
                        <th className="p-4 text-right">Actions</th>`;
const replaceHeader = `<th className="p-4">Weigh-In Scale status</th>
                        {showSignatures && <th className="p-4 text-center">Signature</th>}
                        <th className="p-4 text-right">Actions</th>`;

const targetCell = `<td className="p-4 text-center">
                            {p.weighIn?.signature ? (
                              <img src={p.weighIn.signature} alt="Signature" className="h-8 inline-block bg-white rounded px-1 object-contain border border-line" />
                            ) : (
                              <span className="text-[10px] text-text-dim/50 italic">No signature</span>
                            )}
                          </td>`;
const replaceCell = `{showSignatures && (
                          <td className="p-4 text-center">
                            {p.weighIn?.signature ? (
                              <img src={p.weighIn.signature} alt="Signature" className="h-8 inline-block bg-white rounded px-1 object-contain border border-line" />
                            ) : (
                              <span className="text-[10px] text-text-dim/50 italic">No signature</span>
                            )}
                          </td>
                        )}`;

code = code.split(targetHeader).join(replaceHeader);
code = code.split(targetCell).join(replaceCell);
fs.writeFileSync('src/App.tsx', code);
