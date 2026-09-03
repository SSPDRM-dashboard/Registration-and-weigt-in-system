import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""        setPWeightClass\(p\.weightClass\);\n        setPEventWeightClasses\(\{ \[p\.event\]: p\.weightClass \}\);\n        setPendingPhoto\(p\.photo \|\| null\);""")
replacement = r"""        setPWeightClass(p.weightClass);
        setPEventWeightClasses({ [p.event]: p.weightClass });
        setPEventPoomsaePatterns({ [p.event]: p.poomsaePattern || '' });
        setPendingPhoto(p.photo || null);"""
content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
