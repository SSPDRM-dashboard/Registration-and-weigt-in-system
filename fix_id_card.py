import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '>{p.weightClass || \'—\'}</span>',
    '>{p.weightClass ? p.weightClass + (p.poomsaePattern ? ` / ${p.poomsaePattern}` : \'\') : \'—\'}</span>'
)

content = content.replace(
    '>{p.weightClass}</span>',
    '>{p.weightClass}{p.poomsaePattern ? ` / ${p.poomsaePattern}` : \'\'}</span>'
)

with open('src/App.tsx', 'w') as f:
    f.write(content)
