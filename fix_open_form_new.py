import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""      setPWeightClass\(defaultWc\);\n      setPEventWeightClasses\(\{ \[defaultEv\]: defaultWc \}\);\n      setPendingPhoto\(null\);""")
replacement = r"""      setPWeightClass(defaultWc);
      setPEventWeightClasses({ [defaultEv]: defaultWc });
      setPEventPoomsaePatterns({});
      setPendingPhoto(null);"""
content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
