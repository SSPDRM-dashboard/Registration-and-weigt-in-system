import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const imgTag2 = `                                      <img 
                                        src={r.photo} 
                                        alt={r.fullName} 
                                        className="w-full h-full object-cover rounded-full cursor-pointer hover:opacity-80 transition" 
                                        referrerPolicy="no-referrer"
                                        onClick={() => {
                                          setEnlargedPhotoUrl(r.photo);
                                          setEnlargedPhotoName(r.fullName);
                                       }}
                                      />`;

code = code.replace(
  `                                      <img src={r.photo} alt={r.fullName} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />`,
  imgTag2
);

const imgTag3 = `                              <img 
                                src={ma.photo} 
                                alt={ma.name} 
                                className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition" 
                                referrerPolicy="no-referrer" 
                                onClick={() => {
                                  setEnlargedPhotoUrl(ma.photo);
                                  setEnlargedPhotoName(ma.name);
                                }}
                              />`;

code = code.replace(
  `                              <img src={ma.photo} alt={ma.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />`,
  imgTag3
);

const imgTag4 = `                                          <img 
                                            src={p.photo} 
                                            alt={p.name} 
                                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition" 
                                            onClick={() => {
                                              setEnlargedPhotoUrl(p.photo);
                                              setEnlargedPhotoName(p.name);
                                            }}
                                          />`;

code = code.replace(
  `                                          <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />`,
  imgTag4
);

fs.writeFileSync('src/App.tsx', code);
