// Export plánu do xlsx podle sekce 7.2 specifikace: listy Plán, Vytížení, Nastaveni.

import * as XLSX from 'xlsx';
import { dostupneHodinyVTydnu } from '../domain/scheduler';
import { FAZE, NAVAZUJICI_FAZE, STAV_POPISEK, STROJE, STROJ_POPISEK, nazevFaze, vychoziNastaveni } from '../domain/types';
import type { FazeId, Nastaveni, PracovniCas, Rozvrh, StavAplikace, Zakazka } from '../domain/types';
import { isoNaExcelSerial, pracovniCasNaExcelSerial } from './excelDatum';
import { NAZVY_SLOUPCU, POVINNE_SLOUPCE, SLOUPEC_PORADI_FAZE } from './headers';

const FORMAT_DATUM = 'd.m.yyyy';
const FORMAT_DATUM_CAS = 'd.m.yyyy h:mm';

type Bunka = XLSX.CellObject | string | number | null;

function datum(iso: string): XLSX.CellObject {
  return { t: 'n', v: isoNaExcelSerial(iso), z: FORMAT_DATUM };
}

function datumCas(cas: PracovniCas | undefined, hodDen: number): Bunka {
  return cas ? { t: 'n', v: pracovniCasNaExcelSerial(cas, hodDen), z: FORMAT_DATUM_CAS } : null;
}

export function nazevSouboruExportu(dnesIso: string): string {
  return `plan-zakazek-${dnesIso}.xlsx`;
}

/**
 * Hlavička listu Plán. Sloupce hodin a pořadí front mají pevné názvy (Stroj 1–3 [h], Pořadí Stroj 1–3, kvůli zpětnému načtení),
 * sloupce start/konec fází používají názvy strojů z nastavení.
 */
export function hlavickaPlanu(nastaveni: Nastaveni): string[] {
  return [
    ...POVINNE_SLOUPCE.map((k) => NAZVY_SLOUPCU[k]),
    NAZVY_SLOUPCU.pripravar,
    NAZVY_SLOUPCU.poradi,
    ...NAVAZUJICI_FAZE.map((f) => NAZVY_SLOUPCU[SLOUPEC_PORADI_FAZE[f]]),
    ...FAZE.flatMap((f) => [`${nazevFaze(nastaveni, f)} start`, `${nazevFaze(nastaveni, f)} konec`]),
    'Předpokládané dokončení',
    'Stav',
    'Nejpozdější start TPV',
  ];
}

/** Hlavička s výchozími názvy strojů (pro testy a vzor). */
export const HLAVICKA_PLANU: string[] = hlavickaPlanu(vychoziNastaveni('2026-01-01'));

/** Pořadí řádků: přiřazené podle přípraváře a pořadí ve frontě, pak zásobník podle termínu dokončení. */
function seradZakazky(stav: StavAplikace): Zakazka[] {
  const indexPripravare = new Map(stav.pripravari.map((p, i) => [p.id, i]));
  const prirazeni = new Map(stav.prirazeni.map((p) => [p.zakazkaCislo, p]));
  return [...stav.zakazky].sort((a, b) => {
    const pa = prirazeni.get(a.cislo);
    const pb = prirazeni.get(b.cislo);
    if (pa && pb) {
      return (indexPripravare.get(pa.pripravarId) ?? 0) - (indexPripravare.get(pb.pripravarId) ?? 0) || pa.poradi - pb.poradi;
    }
    if (pa) return -1;
    if (pb) return 1;
    return a.terminDokonceni.localeCompare(b.terminDokonceni) || a.cislo.localeCompare(b.cislo);
  });
}

function hodDenFaze(stav: StavAplikace, faze: FazeId): number {
  return faze === 'tpv' ? stav.nastaveni.hodDenPripravar : stav.nastaveni.hodDenStroj[faze];
}

function listPlan(stav: StavAplikace, rozvrh: Rozvrh): XLSX.WorkSheet {
  const nazvyPripravaru = new Map(stav.pripravari.map((p) => [p.id, p.nazev]));
  const prirazeni = new Map(stav.prirazeni.map((p) => [p.zakazkaCislo, p]));
  const hlavicka = hlavickaPlanu(stav.nastaveni);
  const radky: Bunka[][] = [hlavicka];

  for (const z of seradZakazky(stav)) {
    const r = rozvrh.zakazky[z.cislo];
    const p = prirazeni.get(z.cislo);
    const radek: Bunka[] = [
      z.cislo,
      z.nazev,
      z.firma,
      z.tpvHod,
      z.stroj1Hod,
      z.stroj2Hod,
      z.stroj3Hod,
      z.kompletaceHod,
      datum(z.terminZadani),
      datum(z.terminDokonceni),
      p ? (nazvyPripravaru.get(p.pripravarId) ?? '') : '',
      p ? p.poradi : null,
      ...NAVAZUJICI_FAZE.map((f) => {
        const i = rozvrh.frontyFaze[f].indexOf(z.cislo);
        return i < 0 ? null : i;
      }),
    ];
    for (const faze of FAZE) {
      const f = r?.faze[faze];
      radek.push(datumCas(f?.start, hodDenFaze(stav, faze)), datumCas(f?.konec, hodDenFaze(stav, faze)));
    }
    const dokonceni = r?.predpokladaneDokonceni;
    const posledniFaze = r ? ([...FAZE].reverse().find((f) => r.faze[f]) ?? 'tpv') : 'tpv';
    radek.push(
      datumCas(dokonceni, hodDenFaze(stav, posledniFaze)),
      STAV_POPISEK[r?.stav ?? 'neprirazeno'],
      r ? datum(r.nejpozdejsiStartTpv) : null,
    );
    radky.push(radek);
  }

  const list = XLSX.utils.aoa_to_sheet(radky);
  list['!cols'] = hlavicka.map((h, i) => ({ wch: i <= 2 ? 24 : Math.max(12, h.length + 2) }));
  return list;
}

export function formatVytizeni(prideleno: number, dostupne: number): string {
  const procenta = dostupne > 0 ? Math.round((prideleno / dostupne) * 100) : 0;
  return `${cislo(prideleno)} / ${cislo(dostupne)} (${procenta} %)`;
}

function cislo(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

/** Seřazené ISO týdny vyskytující se ve vytížení. */
export function tydnyVytizeni(rozvrh: Rozvrh): string[] {
  const tydny = new Set<string>();
  for (const podleTydnu of Object.values(rozvrh.vytizeni)) {
    for (const t of Object.keys(podleTydnu)) tydny.add(t);
  }
  return [...tydny].sort();
}

function listVytizeni(stav: StavAplikace, rozvrh: Rozvrh): XLSX.WorkSheet {
  const tydny = tydnyVytizeni(rozvrh);
  const hodDen = stav.nastaveni.hodDenPripravar;
  const radky: Bunka[][] = [['Přípravář', ...tydny]];
  const soucty = tydny.map(() => 0);
  for (const p of stav.pripravari) {
    const radek: Bunka[] = [p.nazev];
    tydny.forEach((t, i) => {
      const prideleno = rozvrh.vytizeni[p.id]?.[t] ?? 0;
      soucty[i] += prideleno;
      radek.push(formatVytizeni(prideleno, dostupneHodinyVTydnu(t, hodDen)));
    });
    radky.push(radek);
  }
  radky.push(['Celkem', ...tydny.map((t, i) => formatVytizeni(soucty[i], dostupneHodinyVTydnu(t, hodDen) * stav.pripravari.length))]);
  const list = XLSX.utils.aoa_to_sheet(radky);
  list['!cols'] = [{ wch: 20 }, ...tydny.map(() => ({ wch: 18 }))];
  return list;
}

function listNastaveni(stav: StavAplikace): XLSX.WorkSheet {
  const n = stav.nastaveni;
  const radky: Bunka[][] = [
    ['Položka', 'Hodnota'],
    ['Začátek plánu', datum(n.zacatekPlanu)],
    ['Rezerva [pracovní dny]', n.rezervaDny],
    ['Přípravář [h/den]', n.hodDenPripravar],
    ...STROJE.map((s): Bunka[] => [`${nazevFaze(n, s)} [h/den]`, n.hodDenStroj[s]]),
    [`${STROJ_POPISEK.kompletace} [h/den]`, n.hodDenStroj.kompletace],
    ...STROJE.map((s): Bunka[] => [`Název ${STROJ_POPISEK[s]}`, nazevFaze(n, s)]),
    ...stav.pripravari.map((p): Bunka[] => [`Přípravář ${p.id}`, p.nazev]),
  ];
  const list = XLSX.utils.aoa_to_sheet(radky);
  list['!cols'] = [{ wch: 26 }, { wch: 16 }];
  return list;
}

export function vytvorSesitExportu(stav: StavAplikace, rozvrh: Rozvrh): XLSX.WorkBook {
  const sesit = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(sesit, listPlan(stav, rozvrh), 'Plán');
  XLSX.utils.book_append_sheet(sesit, listVytizeni(stav, rozvrh), 'Vytížení');
  XLSX.utils.book_append_sheet(sesit, listNastaveni(stav), 'Nastavení');
  return sesit;
}

/** Obsah xlsx souboru (binárně) — UI jej uloží jako Blob. */
export function exportujXlsx(stav: StavAplikace, rozvrh: Rozvrh): Uint8Array<ArrayBuffer> {
  const data = XLSX.write(vytvorSesitExportu(stav, rozvrh), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(data);
}
