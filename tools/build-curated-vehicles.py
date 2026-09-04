"""Small, reviewed primary-source overlay; never extrapolates engine or trim variants."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROWS = []

def add(brand, model, generation, name, start, end, bodies, source, facelift=False, **extra):
    row = dict(brand=brand, model=model, generation=generation, name=name,
               **{'from': start, 'to': end}, facelift=facelift, bodyStyles=bodies,
               sourceUrl=source, confidence='verified', market='Evropa',
               verifiedOn='2026-09-05')
    row.update(extra)
    ROWS.append(row)

def refs(*urls):
    return [{'url': url, 'title': 'Historie a modelové změny výrobce'} for url in urls]

z4intro = 'https://www.press.bmwgroup.com/ireland/article/detail/T0285180EN/the-new-bmw-z4?language=en'
z4fl = 'https://www.press.bmwgroup.com/global/article/detail/T0403900EN/pure-driving-pleasure-new-updates%3A-the-bmw-z4-for-model-year-2023'
z4end = 'https://www.press.bmwgroup.com/global/article/detail/T0453847EN/the-bmw-z4-final-edition-an-exclusive-take-on-the-iconic-roadster?showMedia=photo'
z4production = 'https://www.magna.com/docs/default-source/financial-disclosures/2019/q1/19-05-09---pr---magna-announces-first-quarter-2019-results.pdf?sfvrsn=1ffde3da_11'
add('BMW','Z4','G29','III · G29',2018,2022,['Roadster'],z4intro,
    startBasis='Výroba od 4. čtvrtletí 2018; dodávky od března 2019.',additionalSources=refs(z4production,z4fl))
add('BMW','Z4','G29','III · G29 · facelift',2022,2026,['Roadster'],z4fl,True,
    startBasis='Modernizace uvedena v listopadu 2022 jako modelový rok 2023.',
    notes='Výrobce oznámil ukončení výroby v březnu 2026.',additionalSources=refs(z4end))

bmw3intro = 'https://www.press.bmwgroup.com/global/photo/compilation/T0285128EN/the-all-new-bmw-3-series-sedan?language=en'
bmw3tour = 'https://www.press.bmwgroup.com/czech/article/detail/T0296929CS/nov%C3%A9-bmw-%C5%99ady-3-touring?language=cs'
bmw3fl = 'https://www.press.bmwgroup.com/global/article/detail/T0388273EN/the-new-bmw-3-series-sedan-and-the-new-bmw-3-series-touring'
bmw3update = 'https://www.press.bmwgroup.com/global/article/detail/T0442333EN/the-new-bmw-3-series-sedan-the-new-bmw-3-series-touring'
add('BMW','řada 3','G20','VII · G20 Sedan',2018,2022,['Sedan'],bmw3intro,
    startBasis='Výroba doložena v listopadu 2018; prodejní uvedení 2019.',additionalSources=refs(bmw3fl))
add('BMW','řada 3','G21','VII · G21 Touring',2019,2022,['Kombi'],bmw3tour,
    startBasis='Uvedení na trh 28. září 2019.',additionalSources=refs(bmw3fl))
for code,body,label in [('G20','Sedan','Sedan'),('G21','Kombi','Touring')]:
    add('BMW','řada 3',code,f'VII · {code} {label} · facelift',2022,2024,[body],bmw3fl,True,
        startBasis='Modernizace od července 2022.',additionalSources=refs(bmw3update))
    add('BMW','řada 3',code,f'VII · {code} {label} · modernizace 2024',2024,None,[body],bmw3update,True,
        startBasis='Výrobní změna od července 2024.',notes='Další modernizace stejné generace po faceliftu 2022.')

octTimeline = 'https://cdn.skoda-storyboard.com/2024/05/Octavia_History_a6eedf18.pdf'
octHistory = 'https://www.skoda-auto.cz/novinky/novinky-detail/2026-08-27-skoda-octavia-slavi-30-let-tri-dekady-ikonickeho-modelu'
octEstate = 'https://www.skoda-storyboard.com/cs/skoda-svet-cs/skoda-octavia-combi-25-let-novodobe-kariery/'
octFirst = 'https://www.skoda-storyboard.com/en/press-releases/skoda-octavia-1996-2010-a-magnificent-fourteen-year-career/'
for gen,start,end,bodies,fl in [
    ('I',1996,2000,['Liftback'],False),('I',1998,2000,['Kombi'],False),
    ('I',2000,2010,['Liftback','Kombi'],True),
    ('II',2004,2008,['Liftback','Kombi'],False),('II',2008,2013,['Liftback','Kombi'],True),
    ('III',2012,2017,['Liftback'],False),('III',2013,2017,['Kombi'],False),
    ('III',2017,2020,['Liftback','Kombi'],True),
    ('IV',2019,2024,['Kombi'],False),('IV',2024,None,['Liftback','Kombi'],True),
]:
    add('Škoda','Octavia',gen,gen+(' · facelift' if fl else ''),start,end,bodies,octTimeline,fl,
        additionalSources=refs(octFirst if gen=='I' else octHistory,octEstate),
        startBasis='Roky modelových fází podle historické časové osy výrobce; roky přechodu se překrývají.')
add('Škoda','Octavia','IV','IV · liftback',2020,2024,['Liftback'],
    'https://www.skoda-storyboard.com/cs/tiskove-zpravy-archiv/skoda-zacina-v-cr-prodavat-model-skoda-octavia-v-atraktivnim-provedeni-liftback/',
    startBasis='České objednávky liftbacku od ledna 2020; premiéra obou karoserií v listopadu 2019.',
    additionalSources=refs(octTimeline))

fabTimeline = 'https://cdn.skoda-storyboard.com/2021/04/SKODA_FABIA_History.pdf'
fabHistory = 'https://www.skoda-storyboard.com/en/press-releases/five-million-fabias-skoda-autos-entry-level-model-reaches-major-milestone/'
fabEstate = 'https://cdn.skoda-storyboard.com/2020/09/200919-20_Years_SKODA_FABIA_COMBI.pdf'
fabProduction = 'https://cdn.skoda-storyboard.com/2016/05/skoda-annual-report-2014.pdf'
fab2021 = 'https://cdn.skoda-storyboard.com/2021/09/210916-SKODA-FABIA-dnes-oficialne-vstupuje-na-cesky-trh..pdf'
fab2008 = 'https://cdn.skoda-storyboard.com/2020/09/skoda-auto-annual-report-2008-SK.pdf'
for gen,start,end,bodies,fl in [
    ('I',1999,2004,['Hatchback'],False),('I',2000,2004,['Kombi'],False),
    ('I',2004,2007,['Hatchback','Kombi'],True),
    ('II',2007,2010,['Hatchback','Kombi'],False),('II',2010,2014,['Hatchback','Kombi'],True),
    ('III',2014,2018,['Hatchback','Kombi'],False),
    ('III',2018,2021,['Hatchback'],True),('III',2018,2022,['Kombi'],True),
    ('IV',2021,None,['Hatchback'],False),
]:
    add('Škoda','Fabia',gen,gen+(' · facelift' if fl else ''),start,end,bodies,fabTimeline,fl,
        additionalSources=refs(fabHistory,fabEstate,fabProduction if gen=='III' else fab2021),
        startBasis=('Modelové fáze podle časové osy výrobce; Fabia III Combi ve výrobě od prosince 2014, prodej od 2015.' if gen=='III' else 'Modelové fáze podle časové osy výrobce.'))
add('Škoda','Fabia','I','I · Sedan',2001,2008,['Sedan'],fabHistory,None,
    notes='Výroba sedanu skončila v březnu 2008. Tento záznam ověřuje karoserii a celkové období, nikoliv samostatná data faceliftů sedanu.',
    additionalSources=refs(fab2008))

superbTimeline = 'https://cdn.skoda-storyboard.com/2023/10/Skoda_Superb_History_14928d05.pdf'
superbHistory = 'https://www.skoda-storyboard.com/en/press-kits/the-all-skoda-superb-press-kit-2/history-tracing-the-skoda-superb-from-its-1930s-origins-through-generations-of-innovation/'
superbProduction = 'https://www.skoda-storyboard.com/en/press-releases/skoda-launches-all-new-superb-production-in-bratislava/'
superbCzech = 'https://www.skoda-storyboard.com/cs/tiskove-zpravy-archiv/nova-skoda-superb-ma-cesky-cenik/'
for gen,start,end,bodies,fl in [
    ('I',2001,2006,['Sedan'],False),('I',2006,2008,['Sedan'],True),
    ('II',2008,2013,['Liftback'],False),('II',2009,2013,['Kombi'],False),
    ('II',2013,2015,['Liftback','Kombi'],True),
    ('III',2015,2019,['Liftback','Kombi'],False),('III',2019,2023,['Liftback','Kombi'],True),
]:
    add('Škoda','Superb',gen,gen+(' · facelift' if fl else ''),start,end,bodies,superbTimeline,fl,
        additionalSources=refs(superbHistory),startBasis='Modelové fáze podle historické časové osy výrobce.')
add('Škoda','Superb','IV','IV · Combi',2023,None,['Kombi'],superbProduction,
    startBasis='Výroba od prosince 2023; české dodávky od dubna 2024.',additionalSources=refs(superbCzech))
add('Škoda','Superb','IV','IV · liftback',2024,None,['Liftback'],superbCzech,
    startBasis='Výroba a české dodávky v roce 2024; světová premiéra proběhla v roce 2023.',additionalSources=refs(superbProduction))

golfHistory = 'https://www.volkswagen.at/service-zubehoer/ueber-dein-auto/vorgaengermodelle/golf'
golfBodies = 'https://www.volkswagen-newsroom.com/en/images/topics/model-archive-golf-34'
golf8estate = 'https://www.volkswagen-newsroom.com/en/press-releases/more-space-more-golf-world-premiere-of-the-new-golf-variant-and-golf-alltrack-6369'
golf8fl = 'https://www.volkswagen-newsroom.com/en/press-releases/world-premiere-to-mark-the-50th-anniversary-the-new-golf-is-more-attractive-intelligent-and-efficient-than-ever-before-18083'
golfDoors = 'https://www.volkswagen.de/idhub/content/dam/onehub_pkw/importers/de/geschaeftskunden/sonderzielgruppen/rettungsfahrzeuge/downloads/rettungsdatenblaetter/volkswagen_rettungsdatenblaetter_modelluebersicht_02-2020.pdf'
golf7estate = 'https://www.volkswagen-newsroom.com/en/golf-7-variant-20132020-20041'
golf34cabrio = 'https://www.volkswagen-newsroom.com/en/golf-3-4-cabriolet-19932002-19491'
for gen,start,end in [('I',1974,1983),('II',1983,1991),('III',1991,1997),('IV',1997,2003),('V',2003,2008),('VI',2008,2012),('VII',2012,2017),('VIII',2019,2024)]:
    add('Volkswagen','Golf',gen,gen,start,end,['Hatchback 5 dveří'],golfHistory,None,
        additionalSources=refs(golfDoors),
        notes='Historická generace; drobné průběžné modernizace nejsou tímto záznamem prohlášeny za kompletně rozlišené.')
add('Volkswagen','Golf','VII','VII · facelift',2017,2019,['Hatchback 5 dveří'],golfHistory,True,
    startBasis='Evropské uvedení modernizace 2017; premiéra v listopadu 2016.')
for gen,start,end,body,label in [
    ('I',1979,1993,'Kabriolet','Cabriolet'),('VI',2011,2016,'Kabriolet','Cabriolet'),
    ('III',1993,1999,'Kombi','Variant'),('IV',1999,2006,'Kombi','Variant'),('V',2007,2009,'Kombi','Variant'),('VI',2009,2013,'Kombi','Variant'),
]:
    add('Volkswagen','Golf',gen,f'{gen} · {label}',start,end,[body],golfBodies,None,
        notes='Samostatné výrobní období karoserie podle archivu Volkswagen; vnitřní facelifty nejsou tímto záznamem odděleny.')
add('Volkswagen','Golf','III','III · Cabriolet',1993,1998,['Kabriolet'],golf34cabrio)
add('Volkswagen','Golf','III / IV','IV · Cabriolet (facelift III)',1998,2002,['Kabriolet'],golf34cabrio,True,
    notes='Cabriolet IV je podle výrobce rozsáhlou modernizací karoserie Cabriolet III.')
add('Volkswagen','Golf','VII','VII · Variant',2013,2017,['Kombi'],golf7estate)
add('Volkswagen','Golf','VII','VII · Variant · facelift',2017,2020,['Kombi'],golf7estate,True)
add('Volkswagen','Golf','VIII','VIII · Variant',2020,2024,['Kombi'],golf8estate,additionalSources=refs(golf8fl))
add('Volkswagen','Golf','VIII','VIII · facelift',2024,None,['Hatchback 5 dveří','Kombi'],golf8fl,True,
    startBasis='Modernizace představena v lednu 2024; výroba hatchbacku od dubna 2024.')

passatHistory = 'https://www.volkswagen.at/service-zubehoer/ueber-dein-auto/vorgaengermodelle/passat'
passatEnd = 'https://www.volkswagen-newsroom.com/de/pressemitteilungen/letzter-passat-aus-emden-erfolgsgeschichte-wird-vollelektrisch-fortgesetzt-18291'
passat9 = 'https://www.volkswagen-newsroom.com/en/press-releases/configurator-open-pre-sales-of-the-all-new-passat-have-now-started-17924'
passat9code = 'https://www.volkswagen.de/de/besitzer-und-service/ueber-ihr-auto/vorgaengermodelle/mittelklasse/passat-b8.html'
add('Volkswagen','Passat','B8','B8 · Variant',2014,2019,['Kombi'],passatHistory)
add('Volkswagen','Passat','B8','B8 · Variant · facelift',2019,2024,['Kombi'],passatHistory,True,
    notes='Poslední Passat Variant z Emdenu vyroben 1. března 2024; regionální katalog uvádí modelové období do 2023.',additionalSources=refs(passatEnd))
add('Volkswagen','Passat','B9','IX · B9 · Variant',2023,None,['Kombi'],passat9,
    startBasis='Objednávky od listopadu 2023; první dodávky v 1. čtvrtletí 2024.',additionalSources=refs(passat9code))

# Exact imported labels superseded by the sourced phases above. The importer
# must also require the family and compatible body, preserving Scout/Alltrack,
# three-door Golfs, foreign-market City Golf releases and earlier BMW families.
replacements = {
    ('BMW','Z4'): ['Z4 Roadster (2024)'],
    ('BMW','řada 3'): ['3 Series Sedan (2018)','3 Series Sedan (2022)','3 Series Sedan (2024)',
                       '3 Series Touring (2019)','3 Series Touring (2022)','3 Series Touring (2024)'],
    ('Škoda','Fabia'): ['SKODA Fabia (2000)','SKODA Fabia (2007)','SKODA Fabia (2014)',
                       'SKODA Fabia (2018)','SKODA Fabia (2021)',
                       'SKODA Fabia Combi (2000)','SKODA Fabia Combi (2008)',
                       'SKODA Fabia Combi (2014)','SKODA Fabia Combi (2018)','SKODA Fabia Sedan (2001)'],
    ('Škoda','Octavia'): [f'SKODA Octavia{body} ({year})' for body in ['', ' Combi']
                          for year in [1997,2004,2008,2013,2017,2019,2024]],
    ('Škoda','Superb'): [f'SKODA Superb ({year})' for year in [2002,2006,2008,2013,2015,2019,2023]]
                         + [f'SKODA Superb Combi / Scout ({year})' for year in [2009,2013,2015,2019,2023]],
    ('Volkswagen','Golf'): [f'Golf 5 Doors ({year})' for year in [1974,1983,1992,1997,2003,2008,2012,2017,2019,2024]]
                           + [f'Golf Variant ({year})' for year in [1993,1999,2007,2009,2013,2017,2020,2024]]
                           + [f'Golf Cabrio ({year})' for year in [1993,1998,2011,2015]],
    ('Volkswagen','Passat'): ['Passat Variant (2014)','Passat Variant (2019)','Passat Variant (2023)'],
}
for row in ROWS:
    row['replacesSourceNames'] = replacements[(row['brand'],row['model'])]
    if row['brand']=='BMW' and row['model']=='Z4':
        row['additionalSources'] += refs('https://www.press.bmwgroup.com/global/article/detail/T0439268EN/the-bmw-z4-pure-impulse-edition')

(ROOT/'data'/'curated-vehicles.json').write_text(json.dumps(ROWS,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'rows':len(ROWS),'families':sorted({r['brand']+' / '+r['model'] for r in ROWS})},ensure_ascii=False))
