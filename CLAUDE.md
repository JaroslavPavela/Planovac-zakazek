# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Plánovač zakázek TPV

Aplikace pro plánování zakázek v technické přípravě výroby: import xlsx, přiřazení zakázek šesti přípravářům (drag & drop), dopředný výpočet termínů fází (TPV → stroje → kompletace/ohýbání) s frontami strojů a kompletace, Gantt a tabule pro každou část, vytížení, export xlsx. Jeden uživatel, bez serveru, offline.

## Zdroj pravdy
- `SPECIFIKACE.md` — schválená specifikace (datový model, kalendář, plánovač, UI, struktura, fáze, akceptační testy). Řiď se jí. Pokud něco neřeší nebo si odporuje, **zeptej se** — nerozhoduj sám.

## Stav projektu
- Fáze 1–7 (MVP, specifikace 1.1) hotové; fáze 7 hotová 10. 10. 2026.
- Verze 1.2 (17. 10. 2026): fronty strojů a kompletace + UI po částech Příprava · Stroje · Kompletace · Vytížení (Gantt a pod ním tabule), fáze 8–11 v sekci 10 specifikace. Fáze 8 (doména), 9 (store a xlsx), 10 (UI) a 11 (kontrola: testy, build, průchod import → návrh → přesuny v Přípravě, Stroji 1, Stroji 3 a Kompletaci → export → Vymazat vše → zpětné načtení, ruční přepočet 6 zakázek) hotové a schválené 17. 10. 2026. Verze 1.2 je kompletní; další práce jen na vyžádání.
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
1. **Import** (`src/import`): xlsx → `Zakazka[]`. Hlavičky sloupců se normalizují (malá písmena, bez diakritiky, bez `[h]`) a párují s pevnými klíči, pořadí sloupců je libovolné. Import vždy **nahradí** zakázky, přiřazení i pořadí front strojů a kompletace, nastavení zůstává.
2. **Store** (`src/store/planStore.ts`): Zustand + persist do `localStorage` (klíč `tpv-planovac-v1`). Persistuje se jen `StavAplikace` = `zakazky`, `pripravari`, `prirazeni`, `nastaveni`, `poradiFaze` (verze úložiště 3, starší stav převede `migrujUlozenyStav`). Historie zpět/znovu se týká přiřazení a ručního pořadí front.
3. **Plánovač** (`src/domain/scheduler.ts`): čistá funkce `naplanuj(stav): Rozvrh`. Rozvrh se **nikdy neukládá**, vždy se přepočítá ze stavu (po každé změně přiřazení, nastavení nebo importu).
4. **UI** (`src/ui`): záložky Příprava · Stroje · Kompletace (v každé Gantt z vlastního SVG a pod ním tabule s drag & drop — `Board` pro přípraváře, `QueueBoard` pro fronty strojů a kompletace) a Vytížení — vše jen čte `Rozvrh` a zapisuje změny do store.
5. **Export** (`src/import/xlsxExport.ts`): stav + rozvrh → xlsx; výstup musí jít načíst zpět (sloupce Přípravář + Pořadí obnoví přiřazení, Pořadí Stroj 1–3 / Pořadí kompletace pořadí front).

Klíčové koncepty domény:
- Čas v pracovním kalendáři je `PracovniCas { den: ISO, zlomek: 0–1 }`, ne hodiny. Délka fáze = `hodiny / hodDenZdroje`, takže fáze s různou kapacitou (přípravář 8 h/den, stroj třeba 16 h/den) na sebe navazují bez převodů.
- Řetězec fází jedné zakázky: TPV (sekvenčně ve frontě přípraváře) → stroje (stroje jedné zakázky paralelně) → kompletace po nejdelším stroji. Každý stroj i kompletace má vlastní frontu (sekce 5.7): jedna zakázka po druhé, ruční pořadí `poradiFaze` je závazné (pracoviště čeká), zakázky mimo ruční pořadí se vkládají podle připravenosti. Fáze s 0 h se do rozvrhu nezapisuje.
- Kalendář: po–pá bez českých státních svátků, Velikonoce výpočtem, žádná externí data.
- Stav zakázky (`ok` / `ohrozeno` / `pozde` / `neprirazeno`) se odvozuje z dne dokončení vs. termín − rezerva; dokončení v den termínu je stihnuto.

## Konvence
- Doménová logika v `src/domain` je čistá: bez Reactu, bez přístupu k úložišti a DOM; vstup → výstup, testovatelná.
- Identifikátory v kódu česky bez diakritiky (`zakazka`, `pripravar`, `naplanuj`); texty v UI česky s diakritikou.
- Zdroje rozdělené do souborů podle sekce 9 specifikace; jednosouborový HTML je pouze výstup buildu, ne zdroj.
- Datum v datech jako ISO `YYYY-MM-DD`; čas v pracovním kalendáři jako `{ den, zlomek }` (viz sekce 4). V UI formát `d. M. yyyy`, hodiny s desetinnou čárkou.
