import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { nactiRadky, nactiXlsx, parsujDatum, parsujHodiny } from '../xlsxImport';
import { exportujXlsx, formatVytizeni, nazevSouboruExportu, HLAVICKA_PLANU } from '../xlsxExport';
import { namapujSloupce, normalizujHlavicku } from '../headers';
import { excelSerialNaIso, isoNaExcelSerial, pracovniCasNaExcelSerial, textNaIso } from '../excelDatum';
import { naplanuj } from '../../domain/scheduler';
import { navrhniRozdeleni } from '../../domain/suggest';
import { vychoziNastaveni, vychoziPripravari } from '../../domain/types';
import type { StavAplikace } from '../../domain/types';

const HLAVICKA = ['Číslo zakázky', 'Název', 'Firma', 'TPV [h]', 'Stroj 1 [h]', 'Stroj 2 [h]', 'Stroj 3 [h]', 'Kompletace [h]', 'Termín zadání', 'Termín dokončení'];
const SERIAL_15_10_2026 = 46310;

function sesitZRadku(radky: unknown[][]): Uint8Array {
  const sesit = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(sesit, XLSX.utils.aoa_to_sheet(radky), 'List1');
  return new Uint8Array(XLSX.write(sesit, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

function radek(cislo: string, cast: Partial<Record<string, unknown>> = {}): unknown[] {
  const z = { nazev: 'Název', firma: 'Firma', tpv: 8, f1: 0, f2: 0, v: 0, k: 0, zadani: '2026-10-12', dokonceni: '2026-10-30', ...cast };
  return [cislo, z.nazev, z.firma, z.tpv, z.f1, z.f2, z.v, z.k, z.zadani, z.dokonceni];
}

describe('hlavičky', () => {
  it('normalizace: diakritika, velikost, mezery, [h]', () => {
    expect(normalizujHlavicku('Číslo zakázky')).toBe('cislo zakazky');
    expect(normalizujHlavicku('cislo zakazky')).toBe('cislo zakazky');
    expect(normalizujHlavicku(' ČÍSLO  ZAKÁZKY ')).toBe('cislo zakazky');
    expect(normalizujHlavicku('TPV [h]')).toBe('tpv');
    expect(normalizujHlavicku('TPV')).toBe('tpv');
    expect(normalizujHlavicku('Stroj 1 [ h ]')).toBe('stroj 1');
    expect(normalizujHlavicku(null)).toBe('');
  });

  it('mapování nezávisí na pořadí sloupců a hlásí chybějící', () => {
    const { mapa, chybejici } = namapujSloupce(['Firma', 'TPV', 'Číslo zakázky']);
    expect(mapa).toEqual({ firma: 0, tpv: 1, 'cislo zakazky': 2 });
    expect(chybejici).toEqual(['nazev', 'stroj 1', 'stroj 2', 'stroj 3', 'kompletace', 'termin zadani', 'termin dokonceni']);
    expect(namapujSloupce(HLAVICKA).chybejici).toEqual([]);
  });
});

describe('hodnoty', () => {
  it('datum ze sériového čísla, z textu 15.10.2026 i 2026-10-15', () => {
    expect(excelSerialNaIso(SERIAL_15_10_2026)).toBe('2026-10-15');
    expect(isoNaExcelSerial('2026-10-15')).toBe(SERIAL_15_10_2026);
    expect(parsujDatum(SERIAL_15_10_2026)).toBe('2026-10-15');
    expect(parsujDatum(SERIAL_15_10_2026 + 0.5)).toBe('2026-10-15');
    expect(parsujDatum('15.10.2026')).toBe('2026-10-15');
    expect(parsujDatum('15. 10. 2026')).toBe('2026-10-15');
    expect(parsujDatum('2026-10-15')).toBe('2026-10-15');
    expect(parsujDatum(new Date(2026, 9, 15))).toBe('2026-10-15');
    expect(parsujDatum('31.2.2026')).toBeUndefined();
    expect(parsujDatum('říjen')).toBeUndefined();
    expect(parsujDatum('')).toBeUndefined();
    expect(textNaIso('2026-13-01')).toBeUndefined();
  });

  it('hodiny: 1,5 → 1.5; prázdné → 0; záporné/text → chyba', () => {
    expect(parsujHodiny('1,5')).toBe(1.5);
    expect(parsujHodiny('2.25')).toBe(2.25);
    expect(parsujHodiny(3)).toBe(3);
    expect(parsujHodiny('')).toBe(0);
    expect(parsujHodiny(null)).toBe(0);
    expect(parsujHodiny(undefined)).toBe(0);
    expect(parsujHodiny(-1)).toBeUndefined();
    expect(parsujHodiny('abc')).toBeUndefined();
  });

  it('pracovní čas → datum s časem (8 h/den: 0,5 = 12:00; 16 h/den: 0,5 = 16:00)', () => {
    expect(pracovniCasNaExcelSerial({ den: '2026-10-15', zlomek: 0.5 }, 8)).toBeCloseTo(SERIAL_15_10_2026 + 12 / 24, 9);
    expect(pracovniCasNaExcelSerial({ den: '2026-10-15', zlomek: 0.5 }, 16)).toBeCloseTo(SERIAL_15_10_2026 + 16 / 24, 9);
    expect(pracovniCasNaExcelSerial({ den: '2026-10-15', zlomek: 0 }, 8)).toBeCloseTo(SERIAL_15_10_2026 + 8 / 24, 9);
  });
});

describe('nactiXlsx', () => {
  it('načte zakázky z xlsx s hlavičkami v libovolném pořadí', () => {
    const data = sesitZRadku([
      ['Termín dokončení', 'TPV', 'Firma', 'Název', 'cislo zakazky', 'Stroj 1', 'Stroj 2', 'Stroj 3', 'Kompletace', 'Termín zadání'],
      [SERIAL_15_10_2026, '1,5', 'Firma', 'Kazety', 'Z1', 2, '', null, 0.5, '12.10.2026'],
    ]);
    const v = nactiXlsx(data);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.zakazky).toEqual([
      { cislo: 'Z1', nazev: 'Kazety', firma: 'Firma', tpvHod: 1.5, stroj1Hod: 2, stroj2Hod: 0, stroj3Hod: 0, kompletaceHod: 0.5, terminZadani: '2026-10-12', terminDokonceni: '2026-10-15' },
    ]);
    expect(v.prirazeni).toEqual([]);
    expect(v.preskocene).toEqual([]);
    expect(v.pocetRadku).toBe(1);
  });

  it('chybějící povinný sloupec → chyba, nic se nenačte', () => {
    const v = nactiRadky([['Číslo zakázky', 'Název', 'TPV'], ['Z1', 'A', 8]]);
    expect(v).toEqual({ ok: false, chybejiciSloupce: ['firma', 'stroj 1', 'stroj 2', 'stroj 3', 'kompletace', 'termin zadani', 'termin dokonceni'] });
  });

  it('vadné řádky se přeskočí a vypíší s číslem řádku a důvodem', () => {
    const v = nactiRadky([
      HLAVICKA,
      radek('Z1'),
      radek('', {}),
      radek('Z3', { tpv: -2 }),
      radek('Z4', { tpv: 'hodně' }),
      radek('Z5', { zadani: 'zítra' }),
      radek('Z1', {}),
      [],
      radek('Z7'),
    ]);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.zakazky.map((z) => z.cislo)).toEqual(['Z1', 'Z7']);
    expect(v.preskocene.map((p) => p.radek)).toEqual([3, 4, 5, 6, 7]);
    expect(v.preskocene[0].duvod).toContain('Prázdné číslo');
    expect(v.preskocene[1].duvod).toContain('TPV');
    expect(v.preskocene[2].duvod).toContain('hodně');
    expect(v.preskocene[3].duvod).toContain('Termín zadání');
    expect(v.preskocene[4].duvod).toContain('Duplicitní');
    expect(v.pocetRadku).toBe(7);
  });

  it('termín dokončení před zadáním → varování, řádek se načte', () => {
    const v = nactiRadky([HLAVICKA, radek('Z1', { zadani: '2026-10-20', dokonceni: '2026-10-15' })]);
    expect(v.ok && v.zakazky).toHaveLength(1);
    expect(v.ok && v.varovani).toEqual([{ radek: 2, cislo: 'Z1', text: 'Termín dokončení je dřív než termín zadání' }]);
  });

  it('číselné číslo zakázky se převede na text', () => {
    const v = nactiRadky([HLAVICKA, radek(2026001 as unknown as string)]);
    expect(v.ok && v.zakazky[0].cislo).toBe('2026001');
  });

  it('sloupce Přípravář + Pořadí obnoví přiřazení; neznámý přípravář → zásobník s varováním', () => {
    const pripravari = vychoziPripravari();
    const v = nactiRadky(
      [
        [...HLAVICKA, 'Přípravář', 'Pořadí'],
        [...radek('A'), 'Přípravář 2', 1],
        [...radek('B'), 'přípravář 2', 0],
        [...radek('C'), 'Přípravář 1', null],
        [...radek('D'), 'Karel', 0],
        [...radek('E'), '', ''],
      ],
      pripravari,
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.prirazeni).toEqual([
      { zakazkaCislo: 'B', pripravarId: 'p2', poradi: 0 },
      { zakazkaCislo: 'A', pripravarId: 'p2', poradi: 1 },
      { zakazkaCislo: 'C', pripravarId: 'p1', poradi: 0 },
    ]);
    expect(v.varovani).toEqual([{ radek: 5, cislo: 'D', text: 'Přípravář „Karel“ není v nastavení — zakázka je v zásobníku' }]);
  });

  it('sloupce Pořadí Stroj 1–3 / Pořadí kompletace obnoví ruční pořadí front jen u přiřazených zakázek', () => {
    const v = nactiRadky(
      [
        [...HLAVICKA, 'Přípravář', 'Pořadí', 'Pořadí Stroj 1', 'Pořadí Kompletace'],
        [...radek('A'), 'Přípravář 1', 0, 1, ''],
        [...radek('B'), 'Přípravář 2', 0, '0', 0],
        [...radek('C'), 'Přípravář 1', 1, null, 1],
        [...radek('D'), '', '', 2, 2], // zásobník — do front nepatří
      ],
      vychoziPripravari(),
    );
    expect(v.ok && v.poradiFaze).toEqual({ stroj1: ['B', 'A'], stroj2: [], stroj3: [], kompletace: ['B', 'C'] });
  });

  it('soubor bez sloupců pořadí front → prázdné ruční pořadí', () => {
    const v = nactiRadky([[...HLAVICKA, 'Přípravář'], [...radek('A'), 'Přípravář 1']], vychoziPripravari());
    expect(v.ok && v.poradiFaze).toEqual({ stroj1: [], stroj2: [], stroj3: [], kompletace: [] });
  });

  it('prázdný sešit → chybí všechny povinné sloupce', () => {
    const v = nactiXlsx(sesitZRadku([[]]));
    expect(v.ok).toBe(false);
    expect(!v.ok && v.chybejiciSloupce).toHaveLength(10);
  });
});

describe('export', () => {
  function stavSeVzorkem(): StavAplikace {
    const pripravari = vychoziPripravari();
    pripravari[1] = { id: 'p2', nazev: 'Jana Nováková' };
    const zakazky = [
      radek('Z1', { tpv: 12, f1: 16, k: 8, dokonceni: '2026-10-20' }),
      radek('Z2', { tpv: 8, f2: '4', dokonceni: '2026-10-15' }),
      radek('Z3', { tpv: 4, v: 2, dokonceni: '2026-10-30' }),
      radek('Z4', { tpv: 6, dokonceni: '2026-10-16' }),
    ];
    const nacteno = nactiRadky([HLAVICKA, ...zakazky]);
    if (!nacteno.ok) throw new Error('import selhal');
    const stav: StavAplikace = { zakazky: nacteno.zakazky, pripravari, prirazeni: [], nastaveni: { ...vychoziNastaveni('2026-10-12'), hodDenStroj: { stroj1: 16, stroj2: 8, stroj3: 8, kompletace: 8 } } };
    // ručně: Z1 a Z4 k p2 (Z4 první), Z2 k p1, Z3 zůstane v zásobníku
    stav.prirazeni = [
      { zakazkaCislo: 'Z1', pripravarId: 'p2', poradi: 1 },
      { zakazkaCislo: 'Z4', pripravarId: 'p2', poradi: 0 },
      { zakazkaCislo: 'Z2', pripravarId: 'p1', poradi: 0 },
    ];
    return stav;
  }

  it('export → import obnoví zakázky, přiřazení a pořadí beze změny', () => {
    const stav = stavSeVzorkem();
    const data = exportujXlsx(stav, naplanuj(stav));
    const v = nactiXlsx(data, stav.pripravari);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.preskocene).toEqual([]);
    expect(v.varovani).toEqual([]);
    const seradene = (z: typeof v.zakazky) => [...z].sort((a, b) => a.cislo.localeCompare(b.cislo));
    expect(seradene(v.zakazky)).toEqual(seradene(stav.zakazky));
    const klic = (p: { zakazkaCislo: string; pripravarId: string; poradi: number }) => `${p.pripravarId}/${p.poradi}/${p.zakazkaCislo}`;
    expect(v.prirazeni.map(klic).sort()).toEqual(stav.prirazeni.map(klic).sort());
  });

  it('export po návrhu rozdělení projde kolečkem beze změny', () => {
    const stav = stavSeVzorkem();
    stav.prirazeni = navrhniRozdeleni(stav);
    const v = nactiXlsx(exportujXlsx(stav, naplanuj(stav)), stav.pripravari);
    expect(v.ok && v.prirazeni.length).toBe(4);
    const klic = (p: { zakazkaCislo: string; pripravarId: string; poradi: number }) => `${p.pripravarId}/${p.poradi}/${p.zakazkaCislo}`;
    expect(v.ok && v.prirazeni.map(klic).sort()).toEqual(stav.prirazeni.map(klic).sort());
  });

  it('export → import obnoví ruční pořadí front strojů a kompletace i výsledný rozvrh beze změny', () => {
    const stav = stavSeVzorkem();
    stav.zakazky = stav.zakazky.map((z) => (z.cislo === 'Z2' ? { ...z, stroj1Hod: 8, kompletaceHod: 4 } : z));
    expect(naplanuj(stav).frontyFaze.stroj1).toEqual(['Z2', 'Z1']); // automaticky podle připravenosti
    stav.poradiFaze = { stroj1: ['Z1', 'Z2'], kompletace: ['Z1'] }; // Z2 čeká na stroji 1; v kompletaci se Z2 zařadí podle připravenosti
    const rozvrh = naplanuj(stav);

    const v = nactiXlsx(exportujXlsx(stav, rozvrh), stav.pripravari);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.poradiFaze.stroj1).toEqual(['Z1', 'Z2']);
    const znovu = naplanuj({ ...stav, zakazky: v.zakazky, prirazeni: v.prirazeni, poradiFaze: v.poradiFaze });
    expect(znovu.frontyFaze).toEqual(rozvrh.frontyFaze);
    expect(znovu.zakazky).toEqual(rozvrh.zakazky);
  });

  it('list Plán: pořadí ve frontách strojů a kompletace (prázdné, když zakázka ve frontě není)', () => {
    const stav = stavSeVzorkem();
    const sesit = XLSX.read(exportujXlsx(stav, naplanuj(stav)), { type: 'array' });
    const plan = XLSX.utils.sheet_to_json<unknown[]>(sesit.Sheets['Plán'], { header: 1, raw: true, defval: null });
    const iStroj1 = HLAVICKA_PLANU.indexOf('Pořadí Stroj 1');
    expect(HLAVICKA_PLANU.slice(iStroj1, iStroj1 + 4)).toEqual(['Pořadí Stroj 1', 'Pořadí Stroj 2', 'Pořadí Stroj 3', 'Pořadí kompletace']);
    const radekZ1 = plan.find((r) => r[0] === 'Z1')!;
    expect(radekZ1.slice(iStroj1, iStroj1 + 4)).toEqual([0, null, null, 0]);
    const radekZ3 = plan.find((r) => r[0] === 'Z3')!; // zásobník
    expect(radekZ3.slice(iStroj1, iStroj1 + 4)).toEqual([null, null, null, null]);
  });

  it('list Plán má správné sloupce a data jako excelová data; listy Vytížení a Nastavení existují', () => {
    const stav = stavSeVzorkem();
    const rozvrh = naplanuj(stav);
    const sesit = XLSX.read(exportujXlsx(stav, rozvrh), { type: 'array' });
    expect(sesit.SheetNames).toEqual(['Plán', 'Vytížení', 'Nastavení']);
    const plan = XLSX.utils.sheet_to_json<unknown[]>(sesit.Sheets['Plán'], { header: 1, raw: true });
    expect(plan[0]).toEqual(HLAVICKA_PLANU);
    // první řádek = p1 / Z2 (přiřazené před zásobníkem, podle přípraváře a pořadí)
    expect(plan[1][0]).toBe('Z2');
    expect(plan[1][10]).toBe('Přípravář 1');
    expect(plan[1][11]).toBe(0);
    expect(plan[1][8]).toBe(isoNaExcelSerial('2026-10-12'));
    const iTpvStart = HLAVICKA_PLANU.indexOf('TPV start');
    expect(plan[1][iTpvStart]).toBeCloseTo(isoNaExcelSerial('2026-10-12') + 8 / 24, 9);
    expect(plan[1][HLAVICKA_PLANU.indexOf('Stav')]).toBe('OK');
    // poslední řádek = zásobník Z3
    expect(plan[4][0]).toBe('Z3');
    expect(plan[4][HLAVICKA_PLANU.indexOf('Stav')]).toBe('Nepřiřazeno');
    expect(plan[4][HLAVICKA_PLANU.indexOf('Nejpozdější start TPV')]).toBe(isoNaExcelSerial(rozvrh.zakazky.Z3.nejpozdejsiStartTpv));

    const vytizeni = XLSX.utils.sheet_to_json<unknown[]>(sesit.Sheets['Vytížení'], { header: 1, raw: true });
    expect(vytizeni[0]).toEqual(['Přípravář', '2026-W42']);
    expect(vytizeni[1]).toEqual(['Přípravář 1', '8 / 40 (20 %)']);
    expect(vytizeni[2]).toEqual(['Jana Nováková', '18 / 40 (45 %)']);
    expect(vytizeni[7]).toEqual(['Celkem', '26 / 240 (11 %)']);

    const nastaveni = XLSX.utils.sheet_to_json<unknown[]>(sesit.Sheets['Nastavení'], { header: 1, raw: true });
    expect(nastaveni[1]).toEqual(['Začátek plánu', isoNaExcelSerial('2026-10-12')]);
    expect(nastaveni[4]).toEqual(['Stroj 1 [h/den]', 16]);
  });

  it('formát vytížení a název souboru', () => {
    expect(formatVytizeni(32, 40)).toBe('32 / 40 (80 %)');
    expect(formatVytizeni(12.5, 32)).toBe('12,5 / 32 (39 %)');
    expect(formatVytizeni(0, 0)).toBe('0 / 0 (0 %)');
    expect(nazevSouboruExportu('2026-10-09')).toBe('plan-zakazek-2026-10-09.xlsx');
  });
});

describe('názvy strojů v exportu', () => {
  it('sloupce start/konec používají názvy z nastavení, sloupce hodin zůstávají Stroj 1–3 [h]', async () => {
    const { hlavickaPlanu } = await import('../xlsxExport');
    const { vychoziNastaveni } = await import('../../domain/types');
    const n = vychoziNastaveni('2026-10-12');
    n.nazvyStroju = { stroj1: 'Laser', stroj2: 'Ohraňovák', stroj3: '  ' };
    const h = hlavickaPlanu(n);
    expect(h).toContain('Stroj 1 [h]');
    expect(h).toContain('Laser start');
    expect(h).toContain('Ohraňovák konec');
    expect(h).toContain('Stroj 3 start'); // prázdný název → výchozí
    expect(h).not.toContain('Stroj 1 start');
    expect(h).toContain('Pořadí Stroj 1'); // pořadí front má pevný název kvůli zpětnému načtení
  });
});

describe('aliasy starých hlaviček strojů', () => {
  it('Frézka 1 / Frézka 2 / Vysekávačka se mapují na Stroj 1–3', async () => {
    const { namapujSloupce } = await import('../headers');
    const { mapa, chybejici } = namapujSloupce(['Číslo zakázky', 'Název', 'Firma', 'TPV [h]', 'Frézka 1 [h]', 'Frézka 2 [h]', 'Vysekávačka [h]', 'Kompletace [h]', 'Termín zadání', 'Termín dokončení']);
    expect(chybejici).toEqual([]);
    expect(mapa['stroj 1']).toBe(4);
    expect(mapa['stroj 2']).toBe(5);
    expect(mapa['stroj 3']).toBe(6);
  });
});
