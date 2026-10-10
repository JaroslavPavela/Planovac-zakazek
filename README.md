# Plánovač zakázek TPV

Aplikace pro plánování zakázek v technické přípravě výroby (TPV). Načte xlsx se zakázkami, umožní je přetahováním rozdělit šesti přípravářům, dopředně spočítá termíny všech fází (TPV → stroje → kompletace/ohýbání), ukáže Gantt přípravářů i strojů a vytížení po týdnech a plán vyexportuje do xlsx.

Jeden uživatel, bez serveru, plně offline. Hotová aplikace je jediný soubor `planovani-zakazek.html`, který se otevře dvojklikem v prohlížeči (Chrome, Edge, Firefox) a nepotřebuje internet ani instalaci.

## Použití hotové aplikace

1. Otevři `dist-single/planovani-zakazek.html` v prohlížeči.
2. **Načíst xlsx** – vyber soubor se zakázkami (formát níže; vzor je `vzor/zakazky-vzor.xlsx`). Načtení nahradí všechny aktuální zakázky i přiřazení, nastavení zůstane.
3. Po importu se otevře panel **Nastavení** – zkontroluj hodiny/den strojů a názvy přípravářů.
4. **Navrhnout rozdělení** přiřadí nepřiřazené zakázky přípravářům, kteří jsou nejdříve volní. Výsledek dál upravuj přetahováním karet.
5. Záložky **Gantt přípraváři**, **Gantt stroje** a **Vytížení** ukazují spočítaný plán. Gantt se otevře v přehledu (celý plán na šířku obrazovky); přiblížit ho jde tlačítky **Přehled / − / + / 1 den**, posuvníkem nebo **Ctrl + kolečkem myši** nad grafem, až na jeden den přes celou šířku s hodinami směny v hlavičce. Přiblížení je společné pro oba Gantty; tisk je vždy v přehledu.
6. **Export xlsx** uloží plán do `plan-zakazek-RRRR-MM-DD.xlsx`. Soubor jde znovu načíst a přiřazení i pořadí se obnoví.

Stav aplikace (zakázky, přiřazení, nastavení) se ukládá do úložiště prohlížeče a přežije zavření okna. **Vymazat vše** ho smaže.

### Ovládání tabule

- Vlevo **Zásobník** – nepřiřazené zakázky seřazené podle termínu dokončení. Karta ukazuje hodiny jednotlivých fází (TPV · S1 · S2 · S3 · K), termín a **nejpozdější start TPV**; červený štítek „nestihnutelné“ znamená, že i okamžitý start termín nestihne.
- Vpravo **sloupce přípravářů** – karty v pořadí fronty se spočítaným startem a koncem TPV a předpokládaným dokončením. Barevný pruh: zelená OK, oranžová ohroženo (dokončení v rezervě před termínem), červená pozdě.
- **Přetahování**: zásobník → sloupec, sloupec → sloupec, změna pořadí ve sloupci, karta → zásobník (odebrání). Po každé změně se vše hned přepočítá.
- **Seřadit podle termínu** v hlavičce sloupce přečísluje frontu podle termínu dokončení.
- Klik na kartu otevře detail se všemi fázemi.
- **Zpět / Znovu** vrací změny přiřazení.

### Horní lišta

- **Začátek plánu** – den, od kterého se fronty plánují (výchozí dnes).
- **Rezerva** – počet pracovních dnů před termínem; dokončení v rezervě = stav „ohroženo“.
- **Nastavení** – názvy přípravářů, názvy strojů 1–3 (jen pro zobrazení; sloupce ve vstupním xlsx zůstávají „Stroj 1–3 [h]“), hodiny/den přípraváře, strojů a kompletace.
- **Tisk** – vytiskne všechny čtyři sekce (každou na vlastní stránku na šířku).

## Formát vstupního xlsx

První list, hlavička v 1. řádku, jeden řádek = jedna zakázka. Pořadí sloupců je libovolné, názvy se porovnávají bez ohledu na velikost písmen, diakritiku a přípony `[h]`.

| Sloupec | Typ | Povinný | Poznámka |
|---|---|---|---|
| Číslo zakázky | text | ano | unikátní |
| Název | text | ano | |
| Firma | text | ano | |
| TPV [h] | číslo ≥ 0 | ano | hodiny přípraváře; 0 = bez přípravy |
| Stroj 1 [h] | číslo ≥ 0 | ano | strojní hodiny; 0 / prázdné = stroj se nepoužije |
| Stroj 2 [h] | číslo ≥ 0 | ano | |
| Stroj 3 [h] | číslo ≥ 0 | ano | starší hlavičky „Frézka 1“, „Frézka 2“, „Vysekávačka“ se načtou také |
| Kompletace [h] | číslo ≥ 0 | ano | kompletace / ohýbání |
| Termín zadání | datum | ano | nejdřívější možný start TPV |
| Termín dokončení | datum | ano | |
| Přípravář | text | ne | jen v exportu – obnoví přiřazení (musí odpovídat názvu v nastavení) |
| Pořadí | číslo | ne | jen v exportu – pořadí ve frontě |

- Datum: excelové datum, nebo text `15.10.2026` / `2026-10-15`.
- Hodiny: číslo, nebo text s desetinnou čárkou (`1,5`); prázdná buňka = 0.
- Chybí-li povinný sloupec, import se zastaví a vypíše chybějící sloupce. Vadný řádek (neplatné datum, záporné hodiny, prázdné nebo duplicitní číslo) se přeskočí a vypíše v souhrnu importu.

## Jak se plánuje

- Pracovní kalendář: pondělí–pátek bez českých státních svátků (Velikonoce výpočtem). Přípravář pracuje sekvenčně podle pořadí ve frontě, 8 h/den (nastavitelné).
- TPV zakázky začíná nejdříve v den začátku plánu, termínu zadání a po skončení předchozí zakázky ve frontě.
- Stroje běží po TPV **paralelně** a navzájem nezávisle; délka fáze = hodiny / (hodiny/den stroje). Kolize mezi zakázkami na stroji se neřeší, Gantt strojů je jen zvýrazní.
- Kompletace začíná po nejdelší strojní fázi. Předpokládané dokončení = konec kompletace.
- Stav: dokončení po termínu = **pozdě**; v rezervě před termínem = **ohroženo**; jinak **OK**. Dokončení v den termínu je stihnuto.

## Export

Soubor `plan-zakazek-RRRR-MM-DD.xlsx` má tři listy:

- **Plán** – vstupní sloupce + Přípravář, Pořadí, start a konec každé fáze (datum s časem; 8 h/den → 0,5 dne = 12:00), předpokládané dokončení, stav, nejpozdější start TPV.
- **Vytížení** – přípravář × ISO týden, přidělené / dostupné hodiny.
- **Nastavení** – začátek plánu, rezerva, hodiny/den.

## Vývoj

Požadavky: Node.js 20.19+ nebo 22.12+ (vyžaduje Vite 8).

```
npm install
npm run dev          # vývojový server (http://localhost:5173)
npm test             # testy (Vitest)
npm run build        # dist/ (více souborů) + dist-single/planovani-zakazek.html (jeden soubor)
npm run build:single # jen jednosouborový build
npm run vzor         # vygeneruje vzor/zakazky-vzor.xlsx
```

Stack: TypeScript, React 18, Vite, Zustand (persist), @dnd-kit, SheetJS (`xlsx`), date-fns, Vitest, vite-plugin-singlefile. Za běhu se nedělají žádné síťové požadavky; vše je v buildu.

Struktura zdrojů:

- `src/domain` – čistá doménová logika: kalendář, plánovač, návrh rozdělení, stav zakázky, operace nad přiřazením.
- `src/import` – import a export xlsx, normalizace hlaviček.
- `src/store` – Zustand store s persistencí a historií zpět/znovu.
- `src/ui` – tabule (drag & drop), Gantty (vlastní SVG), vytížení, nastavení.
- `scripts/vytvor-vzor.ts` – generátor vzorového xlsx.

Podrobná specifikace: `SPECIFIKACE.md`.
