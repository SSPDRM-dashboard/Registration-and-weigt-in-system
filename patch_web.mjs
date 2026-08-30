import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const imgTag5 = `                                       className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition"
                                       onClick={() => {
                                         setEnlargedPhotoUrl(r.photo);
                                         setEnlargedPhotoName(r.fullName);
                                       }}
                                     />`;

code = code.replace(
  `                                       className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition"\n                                       onClick={() => {\n                                         setEnlargedPhotoUrl(r.photo);\n                                         setEnlargedPhotoName(r.fullName);\n                                       }}\n                                     />`,
  imgTag5
); // Just in case it was somehow duplicated or malformed

const imgTag6 = `                                     <img 
                                       src={r.photo} 
                                       alt={r.fullName} 
                                       className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setEnlargedPhotoUrl(r.photo);
                                         setEnlargedPhotoName(r.fullName);
                                       }}
                                     />`;

code = code.replace(
  `                                     <img \n                                       src={r.photo} \n                                       alt={r.fullName} \n                                       className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition"\n                                       onClick={() => {\n                                         setEnlargedPhotoUrl(r.photo);\n                                         setEnlargedPhotoName(r.fullName);\n                                       }}\n                                     />`,
  imgTag6
);

fs.writeFileSync('src/App.tsx', code);
