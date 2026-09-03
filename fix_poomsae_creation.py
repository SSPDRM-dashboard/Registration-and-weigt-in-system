import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Update `data` object
pattern1 = re.compile(r"""    const data: Partial<Player> = \{\n      name: pName\.trim\(\),\n      ic: pIc\.trim\(\),\n      dob: pDob,\n      gender: pGender,\n      club: pClub\.trim\(\),\n      ageGroup: pAgeGroup,\n      weightClass: primaryWc,\n      photo: pendingPhoto \|\| undefined,\n      schoolName: pSchoolName\.trim\(\),\n      schoolCode: pSchoolCode\.trim\(\),\n      race: pRace,\n    \};""")
replacement1 = r"""    const data: Partial<Player> = {
      name: pName.trim(),
      ic: pIc.trim(),
      dob: pDob,
      gender: pGender,
      club: pClub.trim(),
      ageGroup: pAgeGroup,
      weightClass: primaryWc,
      poomsaePattern: pEventPoomsaePatterns[primaryEvent] || undefined,
      photo: pendingPhoto || undefined,
      schoolName: pSchoolName.trim(),
      schoolCode: pSchoolCode.trim(),
      race: pRace,
    };"""
content = pattern1.sub(replacement1, content)

# Update extraPlayer
pattern2 = re.compile(r"""          weightClass: extraWc,\n          photo: pendingPhoto \|\| undefined,\n          createdAt: new Date\(\)\.toISOString\(\),\n          weighIn: null,\n          schoolName: pSchoolName\.trim\(\),\n          schoolCode: pSchoolCode\.trim\(\),\n          race: pRace,\n        \};""")
replacement2 = r"""          weightClass: extraWc,
          poomsaePattern: pEventPoomsaePatterns[extraEv] || undefined,
          photo: pendingPhoto || undefined,
          createdAt: new Date().toISOString(),
          weighIn: null,
          schoolName: pSchoolName.trim(),
          schoolCode: pSchoolCode.trim(),
          race: pRace,
        };"""
content = pattern2.sub(replacement2, content)

# Update newPlayer
pattern3 = re.compile(r"""          weightClass: evWc,\n          photo: pendingPhoto \|\| undefined,\n          createdAt: new Date\(\)\.toISOString\(\),\n          weighIn: null,\n          schoolName: pSchoolName\.trim\(\),\n          schoolCode: pSchoolCode\.trim\(\),\n          race: pRace,\n        \};""")
replacement3 = r"""          weightClass: evWc,
          poomsaePattern: pEventPoomsaePatterns[ev] || undefined,
          photo: pendingPhoto || undefined,
          createdAt: new Date().toISOString(),
          weighIn: null,
          schoolName: pSchoolName.trim(),
          schoolCode: pSchoolCode.trim(),
          race: pRace,
        };"""
content = pattern3.sub(replacement3, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
