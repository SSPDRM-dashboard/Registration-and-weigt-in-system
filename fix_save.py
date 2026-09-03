import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""        // Find deleted\n        const deletedPlayer = prevCompPlayers\.find\(p => \!list\.some\(l => l\.id === p\.id\)\);\n        if \(deletedPlayer\) \{\n          await deletePlayerFromFirestore\(deletedPlayer\.id\);\n        \} else \{\n          // Find changed or added\n          const changedPlayers = list\.filter\(p => \{\n            const prev = prevCompPlayers\.find\(pl => pl\.id === p\.id\);\n            return \!prev \|\| JSON\.stringify\(prev\) \!\=\= JSON\.stringify\(p\);\n          \}\);\n          \n          if \(changedPlayers\.length > 0\) \{\n            const savePromises = changedPlayers\.map\(p => savePlayerToFirestore\(p\)\);\n            await Promise\.all\(savePromises\);\n          \}\n        \}""")

replacement = r"""        // Find deleted
        const deletedPlayers = prevCompPlayers.filter(p => !list.some(l => l.id === p.id));
        if (deletedPlayers.length > 0) {
          const deletePromises = deletedPlayers.map(p => deletePlayerFromFirestore(p.id));
          await Promise.all(deletePromises);
        }
        
        // Find changed or added
        const changedPlayers = list.filter(p => {
          const prev = prevCompPlayers.find(pl => pl.id === p.id);
          return !prev || JSON.stringify(prev) !== JSON.stringify(p);
        });
          
        if (changedPlayers.length > 0) {
          const savePromises = changedPlayers.map(p => savePlayerToFirestore(p));
          await Promise.all(savePromises);
        }"""

new_content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(new_content)
