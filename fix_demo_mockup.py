import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""                      const demoMockupPlayer = \{\n                        id: 'ATH-8899',\n                        name: 'MUHAMMAD AMIRUL',\n                        club: 'KUALA LUMPUR DRAGONS',\n                        event: 'Kyorugi \(Sparring\)',\n                        ageGroup: 'Junior \(15-17\)',\n                        gender: 'MALE',\n                        weightClass: 'Under 55kg',\n                        dob: '2010-04-12',\n                        photo: ''\n                      \};""")
replacement = r"""                      const demoMockupPlayer: Partial<Player> = {
                        id: 'ATH-8899',
                        name: 'MUHAMMAD AMIRUL',
                        club: 'KUALA LUMPUR DRAGONS',
                        event: 'Kyorugi (Sparring)',
                        ageGroup: 'Junior (15-17)',
                        gender: 'MALE',
                        weightClass: 'Under 55kg',
                        poomsaePattern: '',
                        dob: '2010-04-12',
                        photo: ''
                      };"""

content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
