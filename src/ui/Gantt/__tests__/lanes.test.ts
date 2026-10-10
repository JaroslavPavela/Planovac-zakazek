import { describe, it, expect } from 'vitest';
import { naplanuj } from '../../../domain/scheduler';
import { vychoziNastaveni, vychoziPripravari } from '../../../domain/types';
import type { StavAplikace, Zakazka } from '../../../domain/types';
import { rozlozDoDrah, spocitejOsu, xCasu, xDne } from '../lanes';

function zakazka(cislo: string, terminDokonceni: string, tpvHod = 8): Zakazka {
  return {
    cislo,
    nazev: cislo,
    firma: 'F',
    tpvHod,
    stroj1Hod: 0,
    stroj2Hod: 0,
    stroj3Hod: 0,
    kompletaceHod: 0,
    terminZadani: '2026-10-12',
    terminDokonceni,
  };
}

function stav(zakazky: Zakazka[], zacatekPlanu = '2026-10-14'): StavAplikace {
  return { zakazky, pripravari: vychoziPripravari(), prirazeni: [], nastaveni: vychoziNastaveni(zacatekPlanu) };
}

describe('spocitejOsu', () => {
  it('začíná pondělím týdne začátku plánu a má minimálně 5 celých týdnů', () => {
    const s = stav([], '2026-10-14'); // středa
    const osa = spocitejOsu(s, naplanuj(s), '2026-10-09');
    expect(osa.od).toBe('2026-10-12');
    expect(osa.do).toBe('2026-11-15');
    expect(osa.dny).toHaveLength(35);
    expect(osa.tydny.map((t) => t.tyden)).toEqual(['2026-W42', '2026-W43', '2026-W44', '2026-W45', '2026-W46']);
    expect(osa.tydny.every((t) => t.pocetDnu === 7)).toBe(true);
    expect(osa.mesice.map((m) => [m.mesic, m.pocetDnu])).toEqual([
      [10, 20],
      [11, 15],
    ]);
    expect(osa.sirka).toBe(35 * osa.sirkaDne);
  });

  it('prodlouží se o 3 dny za nejzazší termín a dorovná na neděli', () => {
    const s = stav([zakazka('A', '2026-12-01')]);
    const osa = spocitejOsu(s, naplanuj(s), '2026-10-09');
    // 1. 12. + 3 dny = 4. 12. (pátek) → neděle 6. 12.
    expect(osa.do).toBe('2026-12-06');
  });

  it('pokrývá konec naplánovaných fází', () => {
    const s: StavAplikace = {
      ...stav([zakazka('A', '2026-10-20', 8 * 30)]),
      prirazeni: [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }],
    };
    const rozvrh = naplanuj(s);
    const osa = spocitejOsu(s, rozvrh, '2026-10-09');
    expect(osa.do >= rozvrh.zakazky.A.faze.tpv!.konec.den).toBe(true);
  });

  it('převádí dny a pracovní čas na x', () => {
    const s = stav([], '2026-10-12');
    const osa = spocitejOsu(s, naplanuj(s), '2026-10-12');
    expect(xDne(osa, '2026-10-12')).toBe(0);
    expect(xDne(osa, '2026-10-14')).toBe(2 * osa.sirkaDne);
    expect(xCasu(osa, { den: '2026-10-13', zlomek: 0.5 })).toBe(1.5 * osa.sirkaDne);
    expect(xDne(osa, '2026-10-10')).toBeLessThan(0);
  });
});

describe('rozlozDoDrah', () => {
  it('nepřekrývající se úseky zůstávají v jedné dráze', () => {
    const { useky, pocetDrah } = rozlozDoDrah([
      { id: 'a', od: 0, do: 2 },
      { id: 'b', od: 2, do: 4 },
      { id: 'c', od: 5, do: 6 },
    ]);
    expect(pocetDrah).toBe(1);
    expect(useky.every((u) => u.draha === 0 && !u.prekryv)).toBe(true);
  });

  it('překrývající se úseky jdou do dalších drah a jsou označené', () => {
    const { useky, pocetDrah } = rozlozDoDrah([
      { id: 'a', od: 0, do: 3 },
      { id: 'b', od: 1, do: 2 },
      { id: 'c', od: 2, do: 5 }, // dráha 0 je obsazená (a do 3), dráha 1 volná (b do 2)
      { id: 'd', od: 3, do: 4 }, // navazuje na a → zpět do dráhy 0
      { id: 'e', od: 2.5, do: 3.5 }, // obě dráhy obsazené → třetí
    ]);
    expect(pocetDrah).toBe(3);
    const podleId = Object.fromEntries(useky.map((u) => [u.usek.id, u]));
    expect(podleId.a.draha).toBe(0);
    expect(podleId.b.draha).toBe(1);
    expect(podleId.c.draha).toBe(1);
    expect(podleId.e.draha).toBe(2);
    expect(podleId.d.draha).toBe(0);
    expect(podleId.a.prekryv).toBe(true);
    expect(podleId.b.prekryv).toBe(true);
    expect(podleId.c.prekryv).toBe(true);
    expect(podleId.d.prekryv).toBe(true); // d (3–4) × c (2–5)
  });

  it('prázdný vstup', () => {
    expect(rozlozDoDrah([])).toEqual({ useky: [], pocetDrah: 0 });
  });
});
