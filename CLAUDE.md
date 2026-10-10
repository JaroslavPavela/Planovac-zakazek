# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Plánovač zakázek TPV

Aplikace pro plánování zakázek v technické přípravě výroby: import xlsx, přiřazení zakázek šesti přípravářům (drag & drop), dopředný výpočet termínů fází (TPV → stroje → kompletace/ohýbání), Gantt přípravářů a strojů, vytížení, export xlsx. Jeden uživatel, bez serveru, offline.

## Zdroj pravdy
- `SPECIFIKACE.md` — schválená specifikace (datový model, kalendář, plánovač, UI, struktura, fáze, akceptační testy). Řiď se jí. Pokud něco neřeší nebo si odporuje, **zeptej se** — nerozhoduj sám.

## Stav projektu
- Fáze 1–6 schválené. Fáze 7 (závěrečná kontrola: testy, průchod import → návrh → přetažení → Gantty → export → zpětné načtení, porovnání 6 zakázek s ručním výpočtem) hotová 10. 10. 2026, čeká na schválení. Tím je MVP podle specifikace kompletní; další práce jen na vyžádání (sekce 12 specifikace, rozšíření mimo MVP).
- Po dokončení každé fáze aktualizuj tuto sekci (která fáze je hotová a schválená).

## Způsob práce
- Komunikuj česky.
- Pracuj **po fázích** ze sekce 10 specifikace. Po každé fázi se zastav, shrň, co vzniklo a jak to ověřit, a čekej na schválení.
- Nic neměň mimo rozsah aktuální fáze. Před větším zásahem (změna struktury, nová závislost, přejmenování) nejdřív navrhni a počkej na souhlas.
- Testy (Vitest) piš průběžně podle sekce 11 a spouštěj je před uzavřením každé fáze.

## Stack
TypeScript 5 · React 18 · Vite · Zustand (persist) · @dnd-kit · SheetJS (`xlsx`) · date-fns (cs) · Vitest · vite-plugin-singlefile.
Žádné CDN ani síťové požadavky za běhu — vše je v buildu; jednosouborový HTML musí běžet z `file://`.

## Příkazy
- `npm run dev` — vývojový server
- `npm test` — všechny testy
- `npx vitest run src/domain/__tests__/calendar.test.ts` — jeden testovací soubor
- `npx vitest run -t "název testu"` — testy podle názvu
- `npm run build` — `dist/` (více souborů) + `dist-single/planovani-zakazek.html` (jeden soubor)
- `npm run build:single` — jen jednosouborový build
- `npm run vzor` — vygeneruje `vzor/zakazky-vzor.xlsx` (skript `scripts/vytvor-vzor.ts`)

## Architektura (tok dat)
1. **Import** (`src/import`): xlsx → `Zakazka[]`. Hlavičky sloupců se normalizují (malá písmena, bez diakritiky, bez `[h]`) a párují s pevnými klíči, pořadí sloupců je libovolné. Import vždy **nahradí** zakázky i přiřazení, nastavení zůstává.
2. **Store** (`src/store/planStore.ts`): Zustand + persist do `localStorage` (klíč `tpv-planovac-v1`). Persistuje se jen `StavAplikace` = `zakazky`, `pripravari`, `prirazeni`, `nastaveni`. Historie zpět/znovu se týká přiřazení.
3. **Plánovač** (`src/domain/scheduler.ts`): čistá funkce `naplanuj(stav): Rozvrh`. Rozvrh se **nikdy neukládá**, vždy se přepočítá ze stavu (po každé změně přiřazení, nastavení nebo importu).
4. **UI** (`src/ui`): Tabule (drag & drop), Gantty (vlastní SVG), Vytížení — vše jen čte `Rozvrh` a zapisuje změny do store.
5. **Export** (`src/import/xlsxExport.ts`): stav + rozvrh → xlsx; výstup musí jít načíst zpět (sloupce Přípravář + Pořadí obnoví přiřazení).

Klíčové koncepty domény:
- Čas v pracovním kalendáři je `PracovniCas { den: ISO, zlomek: 0–1 }`, ne hodiny. Délka fáze = `hodiny / hodDenZdroje`, takže fáze s různou kapacitou (přípravář 8 h/den, stroj třeba 16 h/den) na sebe navazují bez převodů.
- Řetězec fází jedné zakázky: TPV (sekvenčně ve frontě přípraváře) → stroje **paralelně** (nezávisle na ostatních zakázkách, kolize se neřeší) → kompletace po nejdelším stroji. Fáze s 0 h se do rozvrhu nezapisuje.
- Kalendář: po–pá bez českých státních svátků, Velikonoce výpočtem, žádná externí data.
- Stav zakázky (`ok` / `ohrozeno` / `pozde` / `neprirazeno`) se odvozuje z dne dokončení vs. termín − rezerva; dokončení v den termínu je stihnuto.

## Konvence
- Doménová logika v `src/domain` je čistá: bez Reactu, bez přístupu k úložišti a DOM; vstup → výstup, testovatelná.
- Identifikátory v kódu česky bez diakritiky (`zakazka`, `pripravar`, `naplanuj`); texty v UI česky s diakritikou.
- Zdroje rozdělené do souborů podle sekce 9 specifikace; jednosouborový HTML je pouze výstup buildu, ne zdroj.
- Datum v datech jako ISO `YYYY-MM-DD`; čas v pracovním kalendáři jako `{ den, zlomek }` (viz sekce 4). V UI formát `d. M. yyyy`, hodiny s desetinnou čárkou.
