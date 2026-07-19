import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the event badge from the header (there are a few variations)
# Match things like:
# {!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-2 py-0.5 rounded border border-white/20 shrink-0" style={{ fontSize: getFontSizePx(field.fontSize, '10px'), color: field.color || '#ffffff' }}>{p.event}</span>}
# AND
# {!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event || activeComp.name}</span>}

pattern_header_badge = re.compile(
    r"\{!\(p\.id\.startsWith\('STAFF-'\) \|\| p\.ageGroup === 'STAFF'\) && <span className=\"font-display font-bold tracking-wider uppercase bg-slate-950/20 [^\"]+\" style=\{\{ fontSize: getFontSizePx\(field\.fontSize, '[0-9]+px'\), color: field\.color \|\| '#ffffff' \}\}>\{p\.event(?: \|\| activeComp\.name)?\}</span>\}"
)

# 2. In the qrcode block, insert the event name above "Tournament Entry Pass"
# Match things like:
# <p className="font-display font-bold uppercase tracking-wider" style={{ fontSize: getFontSizePx(field.fontSize, '10px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>

# We can find the qrcode block by locating:
# <div className={textAlignmentClass}>
#   <p className="font-display font-bold uppercase tracking-wider

# Let's replace the Tournament Entry Pass p tag to include the event just before it.

pattern_qr_pass = re.compile(
    r'(<div className=\{textAlignmentClass\}>\s*)(<p className="font-display font-bold uppercase tracking-wider(?: text-\[7px\])?" style=\{\{ fontSize: getFontSizePx\(field\.fontSize, \'(?:10px|7px)\'\), color: field\.color \|\| \'#D4AF37\' \}\}>Tournament Entry Pass</p>)'
)

def qr_replace(match):
    # We will extract the font size string from the matched Tournament Entry Pass tag to match sizing if needed,
    # but the original request wants the event as a badge or text.
    # The screenshot shows the event badge as a text/button-like element. Let's make it look like the original badge:
    # "bg-slate-950/20 px-2 py-0.5 rounded border border-white/20 text-white uppercase inline-block mb-1 font-bold tracking-wider"
    
    # We can just put p.event right above "Tournament Entry Pass" with some styling.
    # The screenshot just shows text "KYORUGI (SPARRING)" without border, but maybe let's match the original header styling, or simpler.
    # Actually, in the screenshot, the event name has a red/blue background initially (in header), but if moved to QR code, it might need to stand out.
    # The user says "move the tournament event wording to on top the 'tournament entry pass'"
    return match.group(1) + '{!(p.id.startsWith(\'STAFF-\') || p.ageGroup === \'STAFF\') && <p className="font-display font-bold uppercase tracking-wider bg-slate-950/30 px-1.5 py-0.5 rounded border border-white/10 text-white inline-block mb-1" style={{ fontSize: getFontSizePx(field.fontSize, \'8px\') }}>{p.event}</p>}\n                                        ' + match.group(2)

content = pattern_header_badge.sub('', content)
content = pattern_qr_pass.sub(qr_replace, content)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement complete.")
