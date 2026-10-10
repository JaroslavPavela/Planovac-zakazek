# Specifikace — Plánovač zakázek TPV

Verze 1.1 · schváleno 9. 10. 2026 · 10. 10. 2026 přejmenovány stroje na Stroj 1–3 (dříve frézka 1, frézka 2, vysekávačka), import přijímá i staré hlavičky; názvy strojů editovatelné v nastavení · stav: implementováno

Aplikace pro plánování zakázek v technické přípravě výroby (TPV). Načte xlsx se zakázkami, umožní je přiřadit šesti přípravářům (drag & drop), dopředně spočítá termíny všech fází (TPV → stroje → kompletace/ohýbání), zobrazí Gantt přípravářů i strojů a vytížení po týdnech, a plán exportuje do xlsx. Jeden uživatel, bez serveru, plně offline.

---

## 1. Rozhodnutí a omezení (ze zadání)

| Oblast | Rozhodnutí |
|---|---|
| Jednotky | všechny doby v hodinách (h); TPV = hodiny přípraváře, stroje = strojní hodiny |
| Vstup | xlsx, 1 řádek = 1 zakázka; každé načtení **nahradí** celá data |
| Přípraváři | 6, názvy editovatelné; kapacita 8 h/den; po–pá; bez českých státních svátků |
| Stroje | stroj 1, stroj 2, stroj 3 — běží **paralelně** po TPV; **hodiny/den každého stroje nastavitelné** v aplikaci (výchozí 8) |
| Kompletace / ohýbání | po skončení nejdelší strojní fáze; hodiny/den rovněž nastavitelné (výchozí 8) |
| Kolize strojů | **neřeší se** (stroje jsou jen navazující fáze); překryvy se pouze zobrazí v Ganttu strojů |
| Fronta | 1 zakázka = 1 přípravář; přípravář pracuje sekvenčně |
| Plánování | dopředné od začátku plánu; varování při ohrožení termínu |
| Pořadí | výchozí podle termínu dokončení; ruční úprava drag & drop |
| Stav zakázek | pouze plán (bez sledování rozpracovanosti) |
| Nepřítomnosti | v MVP **vynechány** (možné rozšíření) |
| Výstup | Gantt přípravářů, Gantt strojů, vytížení, export xlsx, tisk |
| Provoz | jeden uživatel, bez serveru, offline, desítky zakázek, horizont ~1 měsíc |

---

## 2. Vstupní soubor xlsx

### 2.1 Sloupce (hlavička v 1. řádku)

| Sloupec | Typ | Povinný | Poznámka |
|---|---|---|---|
| Číslo zakázky | text | ano | unikátní identifikátor |
| Název | text | ano | |
| Firma | text | ano | |
| TPV [h] | číslo ≥ 0 | ano | 0 = bez přípravy |
| Stroj 1 [h] | číslo ≥ 0 | ano | 0/prázdné = stroj se nepoužije |
| Stroj 2 [h] | číslo ≥ 0 | ano | |
| Stroj 3 [h] | číslo ≥ 0 | ano | |
| Kompletace [h] | číslo ≥ 0 | ano | kompletace / ohýbání |
| Termín zadání | datum | ano | nejdřívější možný start TPV |
| Termín dokončení | datum | ano | |
| Přípravář | text | ne | jen v souboru exportovaném z aplikace — obnoví přiřazení |
| Pořadí | číslo | ne | jen v exportu — pořadí ve frontě přípraváře |

### 2.2 Párování sloupců
Název hlavičky se normalizuje: malá písmena, odstranění diakritiky, sloučení mezer, odstranění `[h]`. Porovnává se s klíči: `cislo zakazky`, `nazev`, `firma`, `tpv`, `stroj 1`, `stroj 2`, `stroj 3`, `kompletace`, `termin zadani`, `termin dokonceni`, `pripravar`, `poradi`. Pořadí sloupců v souboru je libovolné.

### 2.3 Formáty hodnot
- Datum: excelové datum (sériové číslo), JS Date, nebo text `15.10.2026` / `2026-10-15`.
- Hodiny: číslo nebo text s desetinnou čárkou (`1,5`).
- Prázdná buňka u hodin = 0.

### 2.4 Validace
- Chybí povinný sloupec → import se **zastaví**, zobrazí se seznam chybějících sloupců.
- Vadný řádek (neplatné datum, záporné/nečíselné hodiny, prázdné číslo zakázky, duplicitní číslo) → řádek se **přeskočí** a vypíše se v souhrnu importu (číslo řádku + důvod).
- Termín dokončení < termín zadání → varování (řádek se načte).

### 2.5 Chování při importu
1. Potvrzovací dialog („Načtení nahradí všechna aktuální data").
2. Zakázky i přiřazení se nahradí. Pokud soubor obsahuje sloupce Přípravář + Pořadí a název přípraváře odpovídá některému v nastavení, přiřazení se obnoví; jinak je zakázka v zásobníku (s varováním).
3. Nastavení (názvy přípravářů, hodiny/den strojů, rezerva) se **zachovává**.
4. Po importu se zobrazí panel nastavení strojů (hodiny/den), aby šly hodnoty hned doplnit.

### 2.6 Vzorová šablona
`vzor/zakazky-vzor.xlsx` — hlavička dle 2.1 + cca 12 ukázkových zakázek (fasádní kazety, obklady, lemování, oplechování…), generovaná skriptem `scripts/vytvor-vzor.ts`, aby byla reprodukovatelná.

---

## 3. Datový model

```ts
// src/domain/types.ts
export type StrojId = 'stroj1' | 'stroj2' | 'stroj3';
export type FazeId = 'tpv' | StrojId | 'kompletace';

export interface Zakazka {
  cislo: string;
  nazev: string;
  firma: string;
  tpvHod: number;
  stroj1Hod: number;
  stroj2Hod: number;
  stroj3Hod: number;
  kompletaceHod: number;
  terminZadani: string;     // ISO 'YYYY-MM-DD'
  terminDokonceni: string;  // ISO 'YYYY-MM-DD'
}

export interface Pripravar {
  id: string;     // 'p1' … 'p6'
  nazev: string;  // výchozí 'Přípravář 1' … 'Přípravář 6'
}

export interface Prirazeni {
  zakazkaCislo: string;
  pripravarId: string;
  poradi: number;   // pořadí ve frontě (0, 1, 2 …)
}

export interface Nastaveni {
  zacatekPlanu: string;        // ISO date; výchozí dnes
  rezervaDny: number;          // pracovní dny; výchozí 1
  hodDenPripravar: number;     // výchozí 8
  hodDenStroj: Record<StrojId | 'kompletace', number>; // výchozí 8 pro každý
  nazvyStroju: Record<StrojId, string>;  // zobrazované názvy strojů, výchozí 'Stroj 1' … 'Stroj 3' (hlavičky xlsx se nemění)
}

/** Okamžik v pracovním kalendáři: pracovní den + zlomek dne 0–1 (nezávislý na hodinách/den zdroje). */
export interface PracovniCas { den: string; zlomek: number; }

export interface FazeRozvrh { start: PracovniCas; konec: PracovniCas; hodiny: number; }

export type Stav = 'ok' | 'ohrozeno' | 'pozde' | 'neprirazeno';

export interface RozvrhZakazky {
  cislo: string;
  pripravarId?: string;
  faze: Partial<Record<FazeId, FazeRozvrh>>;  // jen fáze s hodinami > 0
  predpokladaneDokonceni?: PracovniCas;
  stav: Stav;
  nejpozdejsiStartTpv: string;   // ISO date
  nestihnutelne: boolean;        // nejpozdější start < začátek plánu (nebo < termín zadání)
}

export interface Rozvrh {
  zakazky: Record<string, RozvrhZakazky>;
  konecFronty: Record<string, PracovniCas>;             // per přípravář
  vytizeni: Record<string, Record<string, number>>;     // přípravář → ISO týden ('2026-W42') → přidělené hodiny TPV
}

export interface StavAplikace {
  zakazky: Zakazka[];
  pripravari: Pripravar[];
  prirazeni: Prirazeni[];
  nastaveni: Nastaveni;
}
```

---

## 4. Pracovní kalendář (`src/domain/calendar.ts`)

- Pracovní den = po–pá, který není český státní svátek.
- Svátky: 1. 1., Velký pátek, Velikonoční pondělí, 1. 5., 8. 5., 5. 7., 6. 7., 28. 9., 28. 10., 17. 11., 24. 12., 25. 12., 26. 12. Velikonoce výpočtem (gregoriánský algoritmus), bez externích dat — funguje offline pro libovolný rok.
- Čas se reprezentuje jako `PracovniCas { den, zlomek }`. Délka fáze v dnech = `hodiny / hodDenZdroje`. Díky tomu lze navázat fázi stroje (např. 16 h/den) na konec TPV (8 h/den) bez převodů hodin.
- Funkce:
  - `jePracovniDen(iso)`, `dalsiPracovniDen(iso)`, `predchoziPracovniDen(iso)`, `naPracovniDen(iso)` (posun vpřed, pokud není pracovní)
  - `pridejHodiny(start: PracovniCas, hodiny, hodDen): PracovniCas` — postupuje po pracovních dnech; konec může být `{den, zlomek: 1}` (= konec dne)
  - `odectiHodiny(konec: PracovniCas, hodiny, hodDen): PracovniCas` — zpětný výpočet
  - `porovnej(a, b)`, `max(a, b)`
  - `isoTyden(iso)` → `'2026-W42'`, `pracovniDnyVTydnu(isoTyden)`
  - `pocetPracovnichDnu(od, do)`

Pravidlo: fáze s 0 h má `konec = start` a do rozvrhu se nezapisuje.

---

## 5. Plánovač (`src/domain/scheduler.ts`) — čistá funkce

```
naplanuj(stav: StavAplikace): Rozvrh
```

### 5.1 Fronta přípraváře
Pro každého přípraváře vezmi jeho přiřazení seřazená podle `poradi`, kurzor = `{ naPracovniDen(zacatekPlanu), 0 }`. Pro každou zakázku:

1. `startTpv = max(kurzor, { naPracovniDen(max(terminZadani, zacatekPlanu)), 0 })`
2. `konecTpv = pridejHodiny(startTpv, tpvHod, hodDenPripravar)`; `kurzor = konecTpv`
3. Pro každý stroj s hodinami > 0: `start = konecTpv`, `konec = pridejHodiny(konecTpv, hod, hodDenStroj[stroj])` (paralelně, nezávisle na ostatních zakázkách)
4. `konecStroju = max(konce strojů)`; bez strojů = `konecTpv`
5. Kompletace (pokud > 0): `start = konecStroju`, `konec = pridejHodiny(konecStroju, kompletaceHod, hodDenStroj.kompletace)`
6. `predpokladaneDokonceni = konec kompletace` (resp. `konecStroju`, resp. `konecTpv`)

### 5.2 Stav zakázky
- `pozde` — den dokončení > termín dokončení
- `ohrozeno` — den dokončení > (termín dokončení − `rezervaDny` pracovních dnů) a zároveň ne pozdě
- `ok` — jinak
- `neprirazeno` — bez přiřazení

Dokončení v den termínu (kdykoli během dne) = stihnuto.

### 5.3 Nejpozdější start TPV (pro všechny zakázky, zejména zásobník)
Zpětně od `{ terminDokonceni, zlomek: 1 }`:
1. odečti kompletaci (rychlost kompletace)
2. pro každý stroj s hodinami > 0 odečti jeho hodiny jeho rychlostí → vezmi **nejdřívější** výsledek (nejdelší stroj)
3. odečti TPV (rychlost přípraváře) → `nejpozdejsiStartTpv`
`nestihnutelne = nejpozdejsiStartTpv < max(zacatekPlanu, terminZadani)`

### 5.4 Vytížení
Pro každou TPV fázi rozděl hodiny po dnech (zlomky dne × `hodDenPripravar`) a sečti po ISO týdnech. Dostupné hodiny v týdnu = počet pracovních dnů v týdnu × `hodDenPripravar`.

### 5.5 Navrhnout rozdělení (`src/domain/suggest.ts`)
Hladový algoritmus pouze pro **nepřiřazené** zakázky (stávající přiřazení zůstávají):
1. seřaď zásobník podle termínu dokončení, pak termínu zadání
2. pro každou zakázku vyber přípraváře, jehož `konecFronty` je nejdřívější (při shodě nižší index), a připoj ji na konec jeho fronty
3. po každém připojení přepočítej konec fronty daného přípraváře

Výsledek je návrh — uživatel dál upravuje přetahováním. Akce je vratná (Zpět).

### 5.6 Seřadit frontu podle termínu
U přípraváře přečísluje `poradi` podle termínu dokončení (sekundárně termín zadání).

---

## 6. Uživatelské rozhraní

Jedna stránka, horní lišta + záložky (nebo sekce pod sebou): **Tabule · Gantt přípraváři · Gantt stroje · Vytížení**. Jazyk UI: čeština. Formát data `d. M. yyyy`, hodiny s desetinnou čárkou.

### 6.1 Horní lišta
- **Načíst xlsx** (file input) · **Export xlsx** · **Tisk**
- **Začátek plánu** (datum, výchozí dnes) · **Rezerva** (pracovní dny)
- **Nastavení** (panel): názvy přípravářů 1–6; názvy strojů 1–3 (jen zobrazení, hlavičky xlsx zůstávají Stroj 1–3 [h]); hodiny/den: přípravář, stroj 1, stroj 2, stroj 3, kompletace
- **Navrhnout rozdělení** · **Zpět / Znovu** (historie změn přiřazení) · **Vymazat vše**
- Souhrn: počet zakázek, přiřazeno / v zásobníku, počet pozdě / ohroženo

### 6.2 Tabule (hlavní obrazovka)
- Vlevo **Zásobník**: nepřiřazené zakázky seřazené podle termínu dokončení. Karta: číslo + název (tučně), firma, hodiny (TPV · S1 · S2 · S3 · K), termín dokončení, **nejpozdější start TPV**; červený štítek „nestihnutelné".
- Vpravo **6 sloupců přípravářů**: hlavička (název, součet hodin TPV, datum konce fronty, tlačítko „Seřadit podle termínu"), karty v pořadí fronty se spočítaným startem a koncem TPV a předpokládaným dokončením; barevný pruh podle stavu (ok zelená, ohroženo oranžová, pozdě červená).
- **Drag & drop** (@dnd-kit): zásobník → sloupec, sloupec → sloupec, přeuspořádání ve sloupci, karta → zásobník (odebrání přiřazení). Po každé změně okamžitý přepočet.
- Klik na kartu → detail zakázky (všechny fáze se start/konec, termíny, stav).

### 6.3 Gantt přípravářů (SVG)
- Řádky = přípraváři; osa X = kalendářní dny, hlavička měsíc + ISO týden + den; šířka dne ~28 px, vodorovný posun; horizont od začátku plánu po max(konec poslední fáze, nejzazší termín) + 3 dny, minimálně 5 týdnů.
- Víkendy a svátky šedě podbarvené; svislá čára „dnes"; čára „začátek plánu".
- Pruh = fáze TPV zakázky (start→konec vč. zlomků dne), barva podle stavu, popisek číslo zakázky; značka (kosočtverec) termínu dokončení ve stejném řádku; tooltip s detaily.
- Volitelné zobrazení navazujících fází (stroje, kompletace) ve stejném řádku světlejším odstínem (přepínač).

### 6.4 Gantt strojů (SVG)
- Řádky: stroj 1, stroj 2, stroj 3, kompletace / ohýbání.
- Pruhy fází všech zakázek; v jednom řádku se překrývající intervaly rozloží do dalších drah (hladové přiřazení drah), překrývající se úseky mají zvýrazněný okraj → vidět úzká místa, přestože plán kolize neřeší.
- Stejná osa, posun a tooltipy jako 6.3.

### 6.5 Vytížení
- Tabulka přípravář × ISO týden: `přidělené h / dostupné h (xx %)`; podbarvení: < 80 % zelená, 80–100 % oranžová, > 100 % červená; řádek součtu za všechny přípraváře.
- Dostupné hodiny zohledňují svátky (méně pracovních dnů v týdnu).

### 6.6 Tisk
`@media print`: skrýt ovládací prvky, každá sekce na novou stránku, na šířku, Gantty bez posuvníku v plné šířce (zmenšení měřítka dne).

---

## 7. Perzistence a export

### 7.1 Lokální stav
- Zustand store + `persist` do `localStorage` (klíč `tpv-planovac-v1`): `zakazky`, `pripravari`, `prirazeni`, `nastaveni`. Rozvrh se nepersistuje, vždy se počítá.
- Při startu se stav obnoví; tlačítko „Vymazat vše" s potvrzením.

### 7.2 Export xlsx (`src/import/xlsxExport.ts`)
- List **Plán**: sloupce vstupu (2.1) + `Přípravář`, `Pořadí`, `TPV start`, `TPV konec`, `Stroj 1 start/konec`, `Stroj 2 start/konec`, `Stroj 3 start/konec`, `Kompletace start/konec`, `Předpokládané dokončení`, `Termín dokončení`, `Stav`, `Nejpozdější start TPV`. Data jako skutečná excelová data; zlomek dne jako datum + čas (8 h/den → 0,5 = 12:00 pro přípraváře; pro stroje podle jejich hodin/den).
- List **Vytížení**: tabulka ze sekce 6.5.
- List **Nastavení**: začátek plánu, rezerva, hodiny/den.
- Soubor jde načíst zpět (sloupce Přípravář + Pořadí obnoví přiřazení).
- Název souboru: `plan-zakazek-YYYY-MM-DD.xlsx`.

### 7.3 Záloha JSON (bonus)
Export / import celého `StavAplikace` jako JSON (přesná záloha vč. nastavení).

---

## 8. Technologie

| Vrstva | Volba |
|---|---|
| Jazyk / build | TypeScript 5, Vite |
| UI | React 18 |
| Stav | Zustand (+ persist middleware) |
| Drag & drop | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |
| xlsx | SheetJS (`xlsx`) — čtení i zápis |
| Datum | date-fns (locale cs) + vlastní kalendář (sekce 4) |
| Gantt | vlastní SVG komponenty (bez externí knihovny) |
| Testy | Vitest |
| Jednosouborový build | vite-plugin-singlefile |

Bez CDN a bez síťových požadavků za běhu — vše je v buildu. Jednosouborový HTML musí fungovat z `file://` (inline skripty a styly).

---

## 9. Struktura projektu

```
Planovani zakazek TPV/
  index.html
  package.json · vite.config.ts · vite.single.config.ts · tsconfig.json · vitest.config.ts
  README.md                      (spuštění, build, formát xlsx, ovládání)
  SPECIFIKACE.md                 (tento dokument)
  src/
    main.tsx · App.tsx
    styles/app.css               (vč. @media print)
    domain/
      types.ts · calendar.ts · scheduler.ts · suggest.ts · risk.ts
      __tests__/calendar.test.ts · scheduler.test.ts · suggest.test.ts
    import/
      xlsxImport.ts · xlsxExport.ts · headers.ts (normalizace a mapování sloupců)
      __tests__/xlsxImport.test.ts
    store/
      planStore.ts               (Zustand, persist, historie zpět/znovu)
    ui/
      TopBar.tsx · SettingsPanel.tsx · ImportSummary.tsx
      Board/ Backlog.tsx · PreparerColumn.tsx · OrderCard.tsx · OrderDetail.tsx
      Gantt/ GanttAxis.tsx · GanttPreparers.tsx · GanttMachines.tsx · lanes.ts
      Capacity.tsx
  scripts/vytvor-vzor.ts         (generuje vzor/zakazky-vzor.xlsx)
  vzor/zakazky-vzor.xlsx
  dist/                          (vite build — více souborů)
  dist-single/planovani-zakazek.html   (jednosouborový spustitelný výstup)
```

Skripty v `package.json`: `dev`, `build` (oba buildy), `build:single`, `test`, `vzor`.

---

## 10. Postup realizace (fáze)

Po každé fázi zastavit, shrnout výsledek a čekat na schválení.

1. **Založení projektu** — Vite + React + TS, závislosti, skripty, prázdná aplikace se spustí (`npm run dev`), prázdný test projde.
2. **Doména** — `calendar.ts`, `scheduler.ts`, `suggest.ts` + testy (sekce 11). Bez UI.
3. **Import / export** — `xlsxImport.ts`, `xlsxExport.ts`, `headers.ts`, testy; skript a soubor vzoru.
4. **Tabule** — store, top bar, nastavení, zásobník, sloupce, drag & drop, detail, zpět/znovu, „Navrhnout rozdělení".
5. **Gantty a vytížení** — osa, Gantt přípravářů, Gantt strojů s drahami, tabulka vytížení, tisk.
6. **Build a dokumentace** — jednosouborový HTML, README, kontrola z `file://` offline.
7. **Kontrola** — všechny testy, ruční průchod se vzorovými daty (import → navrhnout → přetáhnout → Gantt → export → znovu načíst export), porovnání několika spočítaných termínů s ručním výpočtem.

---

## 11. Akceptační kritéria a testy

### Kalendář a plánovač
- 12 h TPV (8 h/den) od pondělí `{po, 0}` → konec `{út, 0.5}`.
- 20 h TPV od pátku → konec `{út, 0.5}` (víkend přeskočen).
- Fáze přes svátek (např. 28. 10.) se o den prodlouží.
- Stroj 16 h/den, 8 h práce → 0,5 dne; stroj 8 h/den, 8 h → 1 den.
- Tři stroje paralelně: kompletace začíná po nejdelším z nich.
- Zakázka s nulovými stroji: kompletace navazuje přímo na TPV.
- `startTpv` nikdy před termínem zadání ani před začátkem plánu.
- Stav: dokončení v den termínu = `ok` (při rezervě 0); s rezervou 1 den = `ohrozeno`; den po termínu = `pozde`.
- Nejpozdější start TPV: zpětný výpočet je inverzí dopředného (start → konec → zpět = start).
- Vytížení: 40 h v týdnu bez svátku = 100 %; v týdnu se svátkem je dostupných 32 h.

### Navrhnout rozdělení
- Přiřadí všechny zakázky ze zásobníku; existující přiřazení nezmění; nejdříve zakázky s nejbližším termínem; vybírá nejdříve volného přípraváře.

### Import
- Hlavičky `Číslo zakázky`, `cislo zakazky`, ` ČÍSLO  ZAKÁZKY ` se mapují stejně; `TPV [h]` i `TPV` stejně.
- Datum ze sériového čísla, z textu `15.10.2026` i `2026-10-15`.
- `1,5` → 1.5; prázdné hodiny → 0.
- Chybějící povinný sloupec → chyba, nic se nenačte; vadný řádek → přeskočen a vypsán.
- Export → import obnoví přiřazení a pořadí beze změny.

### UI / provoz
- Drag & drop funguje ve všech směrech (zásobník ↔ sloupce, v rámci sloupce); po změně se vše přepočítá.
- Jednosouborový HTML otevřený dvojklikem (file://) bez internetu: import, plánování, Gantty, export fungují.
- Stav přežije zavření a otevření prohlížeče.

---

## 12. Možná rozšíření (mimo MVP)
- Nepřítomnosti přípravářů (dovolená, nemoc) v kalendáři.
- Kapacitní plánování strojů (jeden stroj = jedna zakázka v čase, fronty strojů).
- Sledování stavu zakázek a skutečných hodin.
- Backend (Node + DB) pro více uživatelů; přímé napojení na ERP (SQL) místo xlsx.
- Zpětné plánování (just-in-time) jako alternativní režim.

---

## 13. Startovací prompt pro Claude Code

```
Přečti SPECIFIKACE.md v tomto adresáři. Implementuj aplikaci přesně podle ní,
po fázích ze sekce 10. Začni fází 1. Po dokončení každé fáze se zastav,
shrň, co vzniklo a jak to ověřit, a čekej na mé schválení před další fází.
Nic neměň mimo rozsah aktuální fáze. Testy ze sekce 11 piš průběžně
ve Vitest a spouštěj je.
```
