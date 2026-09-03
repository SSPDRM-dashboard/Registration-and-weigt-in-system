import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '<td className="p-4 text-text-dim">{p.weightClass}</td>',
    '<td className="p-4 text-text-dim">{p.weightClass}{p.poomsaePattern ? ` / ${p.poomsaePattern}` : \'\'}</td>'
)

content = content.replace(
    '<span className="font-medium">{p.weightClass}</span>',
    '<span className="font-medium">{p.weightClass}{p.poomsaePattern ? ` / ${p.poomsaePattern}` : \'\'}</span>'
)

with open('src/App.tsx', 'w') as f:
    f.write(content)
