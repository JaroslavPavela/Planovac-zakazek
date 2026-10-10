import { describe, it, expect } from 'vitest';
import { navrhniRozdeleni, seradFrontuPodleTerminu } from '../suggest';
import { naplanuj } from '../scheduler';
import { vychoziNastaveni, vychoziPripravari } from '../types';
import type { Prirazeni, StavAplikace, Zakazka } from '../types';

const PO = '2026-10-12';

function zakazka(cislo: string, tpvHod: number, terminDokonceni: string, terminZadani = PO): Zakazka {
  return {
    cislo,
    nazev: cislo,
    firma: 'Firma',
    tpvHod,
    stroj1Hod: 0,
    stroj2Hod: 0,
    stroj3Hod: 0,
    kompletaceHod: 0,
    terminZadani,
    terminDokonceni,
  };
}

function stav(zakazky: Zakazka[], prirazeni: Prirazeni[] = []): StavAplikace {
  return { zakazky, pripravari: vychoziPripravari(), prirazeni, nastaveni: vychoziNastaveni(PO) };
}

describe('navrhniRozdeleni', () => {
  it('přiřadí všechny zakázky ze zásobníku a existující přiřazení nezmění', () => {
    const s = stav(
      [zakazka('A', 8, '2026-10-20'), zakazka('B', 8, '2026-10-15'), zakazka('C', 8, '2026-10-30')],
      [{ zakazkaCislo: 'A', pripravarId: 'p3', poradi: 0 }],
    );
    const vysledek = navrhniRozdeleni(s);
    expect(vysledek).toHaveLength(3);
    expect(vysledek.find((p) => p.zakazkaCislo === 'A')).toEqual({ zakazkaCislo: 'A', pripravarId: 'p3', poradi: 0 });
    expect(new Set(vysledek.map((p) => p.zakazkaCislo))).toEqual(new Set(['A', 'B', 'C']));
    expect(s.prirazeni).toHaveLength(1); // vstup se nemění
  });

  it('nejdříve zakázky s nejbližším termínem, vybírá nejdříve volného přípraváře', () => {
    // 7 zakázek po 8 h: prvních 6 obsadí p1–p6 (podle termínu), sedmá jde za nejdřív volného
    const zakazky = ['G', 'F', 'E', 'D', 'C', 'B', 'A'].map((c, i) => zakazka(c, 8, `2026-10-${20 + i}`));
    const vysledek = navrhniRozdeleni(stav(zakazky));
    const podleCisla = Object.fromEntries(vysledek.map((p) => [p.zakazkaCislo, p]));
    // nejbližší termín má G (20. 10.) → p1, pak F → p2, …
    expect(podleCisla.G).toEqual({ zakazkaCislo: 'G', pripravarId: 'p1', poradi: 0 });
    expect(podleCisla.F.pripravarId).toBe('p2');
    expect(podleCisla.B.pripravarId).toBe('p6');
    // všichni mají shodný konec fronty → při shodě nižší index → A jde za p1 jako druhá
    expect(podleCisla.A).toEqual({ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 1 });
  });

  it('vybírá přípraváře s nejdřívějším koncem fronty', () => {
    const s = stav(
      [zakazka('X', 40, '2026-10-30'), zakazka('Y', 4, '2026-10-30'), zakazka('N', 8, '2026-10-30')],
      [
        { zakazkaCislo: 'X', pripravarId: 'p1', poradi: 0 },
        { zakazkaCislo: 'Y', pripravarId: 'p2', poradi: 0 },
      ],
    );
    // p3–p6 mají prázdnou frontu → N jde k p3
    const vysledek = navrhniRozdeleni(s);
    expect(vysledek.find((p) => p.zakazkaCislo === 'N')).toEqual({ zakazkaCislo: 'N', pripravarId: 'p3', poradi: 0 });

    // když mají všichni plno, vybere se nejkratší fronta (p2 s 4 h)
    const plne = stav(
      [
        zakazka('X', 40, '2026-10-30'),
        zakazka('Y', 4, '2026-10-30'),
        ...['p3', 'p4', 'p5', 'p6'].map((p) => zakazka(`Z${p}`, 16, '2026-10-30')),
        zakazka('N', 8, '2026-10-30'),
      ],
      [
        { zakazkaCislo: 'X', pripravarId: 'p1', poradi: 0 },
        { zakazkaCislo: 'Y', pripravarId: 'p2', poradi: 0 },
        ...['p3', 'p4', 'p5', 'p6'].map((p) => ({ zakazkaCislo: `Z${p}`, pripravarId: p, poradi: 0 })),
      ],
    );
    expect(navrhniRozdeleni(plne).find((p) => p.zakazkaCislo === 'N')).toEqual({ zakazkaCislo: 'N', pripravarId: 'p2', poradi: 1 });
  });

  it('návrh po přepočtu dává každé zakázce rozvrh', () => {
    const s = stav([zakazka('A', 8, '2026-10-20'), zakazka('B', 8, '2026-10-15')]);
    const r = naplanuj({ ...s, prirazeni: navrhniRozdeleni(s) });
    expect(r.zakazky.A.stav).toBe('ok');
    expect(r.zakazky.B.stav).toBe('ok');
  });
});

describe('seradFrontuPodleTerminu', () => {
  it('přečísluje pořadí podle termínu dokončení, pak zadání; ostatní přípraváře nemění', () => {
    const s = stav(
      [
        zakazka('A', 8, '2026-10-30'),
        zakazka('B', 8, '2026-10-20'),
        zakazka('C', 8, '2026-10-20', '2026-10-05'),
        zakazka('D', 8, '2026-10-15'),
      ],
      [
        { zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 },
        { zakazkaCislo: 'B', pripravarId: 'p1', poradi: 1 },
        { zakazkaCislo: 'C', pripravarId: 'p1', poradi: 2 },
        { zakazkaCislo: 'D', pripravarId: 'p2', poradi: 5 },
      ],
    );
    const vysledek = seradFrontuPodleTerminu(s, 'p1');
    const poradi = Object.fromEntries(vysledek.map((p) => [p.zakazkaCislo, p.poradi]));
    expect(poradi).toEqual({ A: 2, B: 1, C: 0, D: 5 });
  });
});
