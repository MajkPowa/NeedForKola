"""Build reviewed Czech legal copy as HTML fragments for the static website.

No customer data or secrets. Only the five explicitly selected public documents
are compiled; the internal operational records are never included.
"""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parents[2]
DOCS = Path(__file__).resolve().parent
SPEC = [
    ("obchodni-podminky", "obchodni-podminky.md", "Pravidla poptávky, konkrétní nabídky a nákupu kol."),
    ("reklamacni-rad", "reklamacni-rad.md", "Jak nahlásit vadu a jaká jsou vaše práva."),
    ("odstoupeni", "odstoupeni-a-formulare.md", "Poučení o vrácení zboží a dobrovolné formuláře."),
    ("soukromi", "ochrana-osobnich-udaju.md", "Jak používáme a chráníme osobní údaje."),
    ("cookies", "cookies.md", "Nezbytné technické úložiště bez reklamního sledování."),
]
LOCAL_LINKS = {
    "Odstoupení a vrácení zboží": "odstoupeni",
    "Reklamační řád": "reklamacni-rad",
    "Ochrana osobních údajů": "soukromi",
}
FORM_LINKS = {
    "Kontaktní formulář": "index.html#kontakt",
    "Formulář odstoupení": "pravni.html?doc=odstoupeni#formular-odstoupeni",
    "Reklamační formulář": "pravni.html?doc=reklamacni-rad#formular-reklamace",
}

def inline(value):
    value = html.escape(value, quote=True)
    value = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"(?<![\w\"=])(https://[^\s<]+)",
                   lambda m: '<a href="' + m.group(1).rstrip(".;,") + '">' + m.group(1).rstrip(".;,") + '</a>' + m.group(1)[len(m.group(1).rstrip(".;,")):], value)
    value = re.sub(r"(?<![\w])info@oarts\.cz", '<a href="mailto:info@oarts.cz">info@oarts.cz</a>', value)
    value = value.replace('+420 723 958 421', '<a href="tel:+420723958421">+420 723 958 421</a>')
    for label, doc_id in LOCAL_LINKS.items():
        value = value.replace('<strong>' + label + '</strong>', '<a href="pravni.html?doc=' + doc_id + '">' + label + '</a>')
    for label, href in FORM_LINKS.items():
        value = value.replace('<strong>' + label + '</strong>', '<a href="' + href + '">' + label + '</a>')
    return value

def blocks(lines):
    result = []
    current = []
    list_items = []
    def flush():
        if current:
            result.append('<p>' + inline(' '.join(current)) + '</p>')
            current.clear()
        if list_items:
            result.append('<ul>' + ''.join('<li>' + inline(item) + '</li>' for item in list_items) + '</ul>')
            list_items.clear()
    for line in lines:
        line = line.strip()
        if not line:
            flush()
        elif line.startswith('- '):
            if current:
                flush()
            list_items.append(line[2:])
        else:
            if list_items:
                flush()
            current.append(line)
    flush()
    return '\n'.join(result)

pages = []
for doc_id, filename, lead in SPEC:
    lines = (DOCS / filename).read_text(encoding='utf-8').splitlines()
    title = lines[0].removeprefix('# ')
    sections = []
    section_title = ''
    section_lines = []
    for line in lines[1:]:
        if line.startswith('Verze '):
            continue
        if line.startswith('## '):
            if section_title or any(section_lines):
                sections.append({'title': section_title, 'html': blocks(section_lines)})
            section_title, section_lines = line[3:], []
        else:
            section_lines.append(line)
    if section_title or any(section_lines):
        sections.append({'title': section_title, 'html': blocks(section_lines)})
    sections = [s for s in sections if s['html']]
    pages.append({
        'id': doc_id, 'title': title, 'version': '2026-10-04', 'lead': lead,
        'source': 'docs/legal/' + filename, 'sections': sections,
        'html': '\n'.join(('<h2>' + html.escape(s['title']) + '</h2>\n' if s['title'] else '') + s['html'] for s in sections),
    })

payload = {
    'version': '2026-10-04',
    'language': 'cs',
    'company': {
        'name': 'Need For Wheels by Oarts s.r.o.', 'ico': '30074088',
        'registeredOffice': 'Příčná 1892/4, Nové Město, 110 00 Praha 1',
        'register': 'Městský soud v Praze, oddíl C, vložka 456867',
        'warehouse': 'Předvrší 846, Ostrava – Krásné Pole, 725 26',
        'phone': '+420 723 958 421', 'email': 'info@oarts.cz',
        'emailOperational': False,
        'vatId': None, 'vatStatus': 'operator_confirmation_required',
    },
    'publicationChecks': [
        'Activate and test info@oarts.cz before transactional launch; current public copy uses working web forms and postal/telephone channels.',
        'Privacy copy describes the final Cloudflare frontend/API/D1 host; verify actual deployment matches.',
        'Cookie page assumes self-hosted fonts, no analytics and admin-only __Host-nfw_admin expiring within 8 hours.',
        'Enforce 12-month deletion of unconverted enquiries after last substantive communication.',
        'Keep transactional checkout disabled until prices, taxes, stock, payment, delivery and actual durable confirmations are operational.',
    ],
    'pages': pages,
}
destination = ROOT / 'data/legal/pages.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(pages)} public legal documents compiled to {destination.relative_to(ROOT)}')
