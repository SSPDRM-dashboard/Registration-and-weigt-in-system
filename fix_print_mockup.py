import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

pattern = re.compile(r"""                              let p = \{\n                                id: 'ATH-1002',\n                                name: 'MOCKUP PLAYER',\n                                club: 'KUALA LUMPUR DRAGONS',\n                                event: 'Kyorugi \(Sparring\)',\n                                ageGroup: 'Junior \(15-17\)',\n                                gender: 'MALE',\n                                weightClass: 'Under 55kg',\n                                dob: '2010-04-12',\n                                photo: ''\n                              \};""")
replacement = r"""                              let p: Partial<Player> = {
                                id: 'ATH-1002',
                                name: 'MOCKUP PLAYER',
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
