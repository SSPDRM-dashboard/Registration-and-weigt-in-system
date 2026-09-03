import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""        let loadedPlayers = cloudPlayers;\n        if \(loadedPlayers\.length === 0\) \{\n          const storedPlayers = localStorage\.getItem\(`app:players:\$\{compId\}`\);\n          if \(storedPlayers\) \{\n            try \{\n              loadedPlayers = JSON\.parse\(storedPlayers\);\n              // Sync to cloud\n              for \(const p of loadedPlayers\) \{\n                savePlayerToFirestore\(p\)\.catch\(err => console\.warn\("Failed to sync player to cloud:", err\)\);\n              \}\n            \} catch \(e\) \{\n              console\.error\("Failed to parse players for comp", compId, e\);\n            \}\n          \}\n        \}""")
replacement = r"""        let loadedPlayers = cloudPlayers;
        // The previous fallback to localStorage when cloudPlayers.length === 0 caused deleted players 
        // to be resurrected if another client still had them in localStorage."""

content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
