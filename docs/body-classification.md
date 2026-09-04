# Vehicle body classification

`tools/vehicle_bodies.py` exports `classify_body(brand_id, model_id, source_model_name, generation_name, start_year)`. It returns exactly one `{id, name, basis}` object for exactly one source generation. It never expands model years or creates a Cartesian product of bodies, facelifts and generations.

`basis` is `source-name` when the generation explicitly identifies the body, `family-curation` when a reviewed family or marketing-name rule is needed, and `unresolved` when this source record does not identify a unique body. `unknown` means “Karoserie neuvedena”, not another physical body style. Retain the raw source title and its individual production interval next to the result.

The source database has null `bodyType` fields. A source-name classification is evidence about its title, not independent verification of the source's dates. Family curation is taxonomy, not a claim that all historical bodies or market variations are present. The generic hatchback, SUV, MPV and pickup labels deliberately avoid inventing door counts, cab lengths or chassis codes. Explicit 3/5-door or cab descriptions are preserved where the known family makes their meaning clear.

Rules are source-first. `Touring`, `Avant`, `Combi`, `T-Modell`, `Station Wagon` and equivalent explicit labels identify a wagon, while BMW Active/Gran Tourer identifies an MPV. Sports-car cabriolet, roadster and spider names share the `cabriolet` class; Targa remains separate. SUV coupés and SUV convertibles are distinguished. A marketing “Coupe” may still be a hatchback (for example C4 Coupe), so those names have specific exceptions. BMW Gran Coupé does not imply the same physical rear closure across series. Raw titles are preserved by the importer even when the UI uses a simpler body label.

Known name reuses are date-sensitive: Ford Puma, Fiat 600, Peugeot 5008, Renault Espace/Scenic, Kia ProCeed, Maserati Ghibli and SsangYong Musso. The date supplied here is the **source generation's start year**, not the user's selected model year. These thresholds only classify records that already exist; they do not establish launch/production availability. Source entries may begin at announcement rather than first delivery, and the importer must retain its separate announced/production status.

Important limitations remain explicit. Berlingo, Combo, Caddy, Doblò, Kangoo and Transit rows can collapse passenger and commercial bodies. Many Impreza rows repeat the same generic name despite differing bodies. MG5 can mean a sedan or an estate in different markets. Those rows remain unresolved unless a source title or a separate curated record disambiguates them. Classic Fiat 500 records are not automatically labelled as hatchbacks or convertibles merely because the modern nameplate has those variants. A fabric sunroof alone is insufficient to infer a convertible.

## Primary references for special cases

Checked 5 September 2026. These references support the listed exceptions, not a blanket claim that every imported row has been independently checked.

- [BMW 4 Series Gran Coupé press kit](https://www.press.bmwgroup.com/usa/article/detail/T0165322EN_US/the-new-bmw-4-series-gran-coupe): opening tailgate; classified as liftback.
- [BMW 8 Series Gran Coupé](https://www.press.bmwgroup.com/united-kingdom/article/detail/T0295165EN/the-bmw-8-series-gran-coupe-%E2%80%93-a-four-door-sports-car-of-sublime-elegance-and-modern-luxury): four-door coupé family, retained separately from the 4 Series liftback classification.
- [Audi A5 room concept](https://www.audi.com/en/the-new-audi-a5-models-modern-sportiness-meets-premium-proportions-16261/room-concept-and-functionality-16277): the 2024 A5 Sedan's lid opens with the rear window, so its physical body class is liftback despite the marketed name.
- [Ford's Puma history](https://media.ford.com/content/fordmedia/feu/de/de/news/2020/01/17/_cool-cats_-_-ueber-die-evolution-des-ford-puma.html) and [2019 crossover announcement](https://media.ford.com/content/fordmedia/feu/gb/en/news/2019/04/03/ford-delivers-first-glimpse-of-athletic--innovative-puma-crossov.html): original coupé versus new crossover.
- [Peugeot 5008 SUV launch](https://www.media.stellantis.com/em-en/peugeot/press/the-all-new-peugeot-5008-a-whole-new-dimension-for-suvs): second-generation SUV unveiled in 2016, launched in 2017; predecessor was an MPV.
- [Peugeot 508 2018 press kit](https://www.media.stellantis.com/em-en/download-model-document/186): new liftgate fastback replaces the previous boot-lid saloon shape.
- [Renault Espace 2023](https://media.renault.com/nouveau-renault-espace-ladn-de-lespace-nouvelle-generation/?lang=fra) and [Scenic E-Tech 2023](https://media.renault.com/the-all-new-renault-scenic-e-tech-electric-the-first-more-sustainably-designed-all-electric-family-vehicle/?lang=eng): new SUV-era vehicles versus earlier MPV families.
- [Kia ProCeed 2018](https://press.kia.com/ie/en/home/media-resouces/press-releases/2018/Kia_introduces_new_ProCeed.html): new shooting brake family, represented as wagon.
- [Fiat 600e introduction](https://www.media.stellantis.com/em-en/fiat/press/fiat-the-future-is-on-track) and [historical Fiat 600](https://o.media.stellantis.com/ar-es/fiat/press/el-fiat-600-y-su-legado-de-65-anos-en-la-cultura-automotriz-argentina): modern B-SUV versus original rear-engine vehicle.
- [KGM Musso](https://www.kgm-motors.co.uk/new-cars/musso/) and [KGM timeline](https://www.kgm-motors.co.uk/our-story/): modern pickup identity and 2018 launch. The classifier does not assume the old Musso SUV was a pickup.
- [GMC 2021 Hummer EV announcement](https://news.gmc.com/newsroom.detail.html/Pages/news/us/en/2021/jul/0701-hummer.html): 2021 source record refers to pickup launch. Later SUV records must be identified separately.
- [Subaru's 2024 Impreza brochure](https://www.subaru.com/content/dam/subaru/downloads/pdf/brochures/2024/MY24_Impreza_Brochure.pdf): current generation hatchback, unlike historical source rows that combine bodies.
- [Subaru's 2025 Outback announcement](https://www.subaru.co.jp/pdf/news-en/en2025_0418_1_2025-04-17-165155.pdf): the new 2026 model introduces a distinct SUV profile. The source generation starting in 2025 is classified as SUV.
- [Nissan's third-generation Leaf introduction](https://global.nissannews.com/en/releases/leaf-insights-design): the new 2025 source generation is a crossover instead of the earlier hatchback family.

## Verification and audit

Run `python tools/check_vehicle_bodies.py` for ambiguity regressions and `python tools/vehicle_bodies.py` to regenerate `data/source/body-classification-audit.json`. With `data/model-crosswalk.json` present, the audit covers matched requested families and lists every unresolved source record. Without the crosswalk, it audits raw models across the requested brands and explicitly labels that broader scope. The audit does not count manually curated variants added later by the parent importer.
