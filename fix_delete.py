import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""  const handleDeletePlayer = \(playerId: string\) => \{\n    if \(\!compId\) return;\n    if \(role === 'coach'\) \{\n      triggerMsg\('Coaches are not permitted to delete athlete records\.', 'error'\);\n      return;\n    \}\n    const updated = players\.filter\(p => p\.id \!\=\= playerId\);\n    savePlayersToStorage\(compId, updated\);\n    setConfirmDeleteId\(null\);\n    triggerMsg\('Athlete registration retracted\.', 'ok'\);\n  \};""")

replacement = r"""  const handleDeletePlayer = async (playerId: string) => {
    if (!compId) return;
    if (role === 'coach') {
      triggerMsg('Coaches are not permitted to delete athlete records.', 'error');
      return;
    }
    const updated = players.filter(p => p.id !== playerId);
    setPlayers(updated);
    localStorage.setItem(`app:players:${compId}`, JSON.stringify(updated));
    setConfirmDeleteId(null);
    
    try {
      await deletePlayerFromFirestore(playerId);
      triggerMsg('Athlete registration retracted.', 'ok');
    } catch (e) {
      console.error('Failed to delete athlete:', e);
      triggerMsg('Error removing athlete from cloud. Please try again.', 'error');
    }
  };"""

new_content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(new_content)
