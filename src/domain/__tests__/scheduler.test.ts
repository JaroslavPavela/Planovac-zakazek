import { describe, it, expect } from 'vitest';
import { dostupneHodinyVTydnu, hodinyPoDnech, naplanuj, sestavFrontu } from '../scheduler';
import { nejpozdejsiStart, urciStav } from '../risk';
import { vychoziNastaveni, vychoziPripravari } from '../types';
import type { Nastaveni, Prirazeni, StavAplikace, Zakazka } from '../types';

const PO = '2026-10-12';
const UT = '2026-10-13';

function zakazka(cislo: string, cast: Partial<Zakazka> = {}): Zakazka {
  return {
    cislo,
    nazev: `Zakázka ${cislo}`,
    firma: 'Firma',
    tpvHod: 8,
    stroj1Hod: 0,
    stroj2Hod: 0,
    stroj3Hod: 0,
    kompletaceHod: 0,
    terminZadani: PO,
    terminDokonceni: '2026-10-30',
    ...cast,
  };
}

function stav(zakazky: Zakazka[], prirazeni: Prirazeni[], nastaveni: Partial<Nastaveni> = {}): StavAplikace {
  return {
    zakazky,
    pripravari: vychoziPripravari(),
    prirazeni,
    nastaveni: { ...vychoziNastaveni(PO), rezervaDny: 0, ...nastaveni },
  };
}

describe('naplanuj — fronta přípraváře', () => {
  it('zakázky ve frontě navazují sekvenčně podle pořadí', () => {
    const r = naplanuj(
      stav(
        [zakazka('A', { tpvHod: 12 }), zakazka('B', { tpvHod: 8 })],
        [
          { zakazkaCislo: 'B', pripravarId: 'p1', poradi: 1 },
          { zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 },
        ],
      ),
    );
    expect(r.zakazky.A.faze.tpv).toEqual({ start: { den: PO, zlomek: 0 }, konec: { den: UT, zlomek: 0.5 }, hodiny: 12 });
    expect(r.zakazky.B.faze.tpv).toEqual({ start: { den: UT, zlomek: 0.5 }, konec: { den: '2026-10-14', zlomek: 0.5 }, hodiny: 8 });
    expect(r.konecFronty.p1).toEqual({ den: '2026-10-14', zlomek: 0.5 });
    expect(r.konecFronty.p2).toEqual({ den: PO, zlomek: 0 });
  });

  it('startTpv není před termínem zadání ani před začátkem plánu', () => {
    const r = naplanuj(
      stav(
        [zakazka('A', { terminZadani: '2026-10-15' }), zakazka('B', { terminZadani: '2026-10-01' })],
        [
          { zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 },
          { zakazkaCislo: 'B', pripravarId: 'p2', poradi: 0 },
        ],
        { zacatekPlanu: '2026-10-10' }, // sobota → plán začíná v pondělí 12. 10.
      ),
    );
    expect(r.zakazky.A.faze.tpv!.start).toEqual({ den: '2026-10-15', zlomek: 0 });
    expect(r.zakazky.B.faze.tpv!.start).toEqual({ den: PO, zlomek: 0 });
  });

  it('termín zadání uprostřed fronty posune start a vytvoří mezeru', () => {
    const r = naplanuj(
      stav(
        [zakazka('A', { tpvHod: 4 }), zakazka('B', { tpvHod: 4, terminZadani: '2026-10-14' })],
        [
          { zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 },
          { zakazkaCislo: 'B', pripravarId: 'p1', poradi: 1 },
        ],
      ),
    );
    expect(r.zakazky.B.faze.tpv!.start).toEqual({ den: '2026-10-14', zlomek: 0 });
  });
});

describe('naplanuj — navazující fáze', () => {
  it('tři stroje paralelně, kompletace po nejdelším', () => {
    const r = naplanuj(
      stav(
        [zakazka('A', { tpvHod: 8, stroj1Hod: 4, stroj2Hod: 16, stroj3Hod: 8, kompletaceHod: 8 })],
        [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }],
      ),
    );
    const f = r.zakazky.A.faze;
    const konecTpv = { den: PO, zlomek: 1 };
    expect(f.tpv!.konec).toEqual(konecTpv);
    expect(f.stroj1!.start).toEqual(konecTpv);
    expect(f.stroj2!.start).toEqual(konecTpv);
    expect(f.stroj3!.start).toEqual(konecTpv);
    expect(f.stroj1!.konec).toEqual({ den: UT, zlomek: 0.5 });
    expect(f.stroj2!.konec).toEqual({ den: '2026-10-14', zlomek: 1 });
    expect(f.stroj3!.konec).toEqual({ den: UT, zlomek: 1 });
    expect(f.kompletace!.start).toEqual({ den: '2026-10-14', zlomek: 1 });
    expect(f.kompletace!.konec).toEqual({ den: '2026-10-15', zlomek: 1 });
    expect(r.zakazky.A.predpokladaneDokonceni).toEqual({ den: '2026-10-15', zlomek: 1 });
  });

  it('kapacita stroje: 16 h/den → 8 h trvá půl dne', () => {
    const r = naplanuj(
      stav([zakazka('A', { tpvHod: 8, stroj1Hod: 8 })], [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }], {
        hodDenStroj: { stroj1: 16, stroj2: 8, stroj3: 8, kompletace: 8 },
      }),
    );
    expect(r.zakazky.A.faze.stroj1!.konec).toEqual({ den: UT, zlomek: 0.5 });
  });

  it('zakázka bez strojů: kompletace navazuje přímo na TPV', () => {
    const r = naplanuj(
      stav([zakazka('A', { tpvHod: 4, kompletaceHod: 4 })], [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }]),
    );
    const f = r.zakazky.A.faze;
    expect(f.stroj1).toBeUndefined();
    expect(f.kompletace!.start).toEqual({ den: PO, zlomek: 0.5 });
    expect(f.kompletace!.konec).toEqual({ den: PO, zlomek: 1 });
    expect(Object.keys(f)).toEqual(['tpv', 'kompletace']);
  });

  it('fáze s 0 h se nezapisují; zakázka jen s TPV končí koncem TPV', () => {
    const r = naplanuj(stav([zakazka('A', { tpvHod: 12 })], [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }]));
    expect(Object.keys(r.zakazky.A.faze)).toEqual(['tpv']);
    expect(r.zakazky.A.predpokladaneDokonceni).toEqual({ den: UT, zlomek: 0.5 });
  });

  it('stroje a kompletace mají jako připravenost konec předchozí fáze', () => {
    const r = naplanuj(
      stav([zakazka('A', { tpvHod: 8, stroj1Hod: 4, stroj2Hod: 8, kompletaceHod: 4 })], [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }]),
    );
    const f = r.zakazky.A.faze;
    expect(f.tpv!.pripraveno).toBeUndefined();
    expect(f.stroj1!.pripraveno).toEqual({ den: PO, zlomek: 1 });
    expect(f.kompletace!.pripraveno).toEqual({ den: UT, zlomek: 1 });
  });
});

describe('naplanuj — fronty strojů a kompletace', () => {
  const dveNaStroji1 = (cast: Partial<Zakazka> = {}) => [
    zakazka('A', { tpvHod: 8, stroj1Hod: 8 }),
    zakazka('B', { tpvHod: 8, stroj1Hod: 8, ...cast }),
  ];
  const kazdyJinyPripravar: Prirazeni[] = [
    { zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 },
    { zakazkaCislo: 'B', pripravarId: 'p2', poradi: 0 },
  ];

  it('dvě zakázky na stejném stroji se nepřekrývají, výchozí pořadí podle připravenosti', () => {
    const r = naplanuj(stav(dveNaStroji1(), kazdyJinyPripravar));
    expect(r.frontyFaze.stroj1).toEqual(['A', 'B']);
    expect(r.zakazky.A.faze.stroj1).toMatchObject({ start: { den: PO, zlomek: 1 }, konec: { den: UT, zlomek: 1 } });
    expect(r.zakazky.B.faze.stroj1).toMatchObject({ start: { den: UT, zlomek: 1 }, konec: { den: '2026-10-14', zlomek: 1 } });
    expect(r.zakazky.B.faze.stroj1!.pripraveno).toEqual({ den: PO, zlomek: 1 }); // čekala ve frontě
  });

  it('ruční pořadí fronty určí, kdo jde na stroj první', () => {
    const r = naplanuj({ ...stav(dveNaStroji1(), kazdyJinyPripravar), poradiFaze: { stroj1: ['B', 'A'] } });
    expect(r.frontyFaze.stroj1).toEqual(['B', 'A']);
    expect(r.zakazky.B.faze.stroj1).toMatchObject({ start: { den: PO, zlomek: 1 }, konec: { den: UT, zlomek: 1 } });
    expect(r.zakazky.A.faze.stroj1).toMatchObject({ start: { den: UT, zlomek: 1 }, konec: { den: '2026-10-14', zlomek: 1 } });
  });

  it('stroj čeká na zakázku, která je ve frontě dřív, i když ještě nemá hotové TPV', () => {
    const zakazky = [zakazka('A', { tpvHod: 40, stroj1Hod: 8 }), zakazka('B', { tpvHod: 8, stroj1Hod: 8, terminDokonceni: '2026-10-16' })];
    const auto = naplanuj(stav(zakazky, kazdyJinyPripravar));
    expect(auto.frontyFaze.stroj1).toEqual(['B', 'A']);
    expect(auto.zakazky.B.stav).toBe('ok');

    const r = naplanuj({ ...stav(zakazky, kazdyJinyPripravar), poradiFaze: { stroj1: ['A', 'B'] } });
    // A má TPV hotové v pátek 16. 10. večer, stroj 1 na ni čeká; B jde až po ní.
    expect(r.zakazky.A.faze.stroj1).toMatchObject({ start: { den: '2026-10-16', zlomek: 1 }, konec: { den: '2026-10-19', zlomek: 1 } });
    expect(r.zakazky.B.faze.stroj1).toMatchObject({ start: { den: '2026-10-19', zlomek: 1 }, konec: { den: '2026-10-20', zlomek: 1 } });
    expect(r.zakazky.B.predpokladaneDokonceni).toEqual({ den: '2026-10-20', zlomek: 1 });
    expect(r.zakazky.B.stav).toBe('pozde');
  });

  it('kompletace čeká na nejdelší stroj zakázky i na předchozí zakázku ve frontě kompletace', () => {
    const zakazky = [
      zakazka('A', { tpvHod: 8, stroj1Hod: 8, kompletaceHod: 8 }),
      zakazka('B', { tpvHod: 8, stroj2Hod: 16, kompletaceHod: 8 }),
    ];
    const auto = naplanuj(stav(zakazky, kazdyJinyPripravar));
    expect(auto.frontyFaze.kompletace).toEqual(['A', 'B']);
    expect(auto.zakazky.A.faze.kompletace).toMatchObject({ start: { den: UT, zlomek: 1 }, konec: { den: '2026-10-14', zlomek: 1 } });
    expect(auto.zakazky.B.faze.kompletace).toMatchObject({ start: { den: '2026-10-14', zlomek: 1 }, konec: { den: '2026-10-15', zlomek: 1 } });

    const r = naplanuj({ ...stav(zakazky, kazdyJinyPripravar), poradiFaze: { kompletace: ['B', 'A'] } });
    expect(r.zakazky.B.faze.kompletace).toMatchObject({ start: { den: '2026-10-14', zlomek: 1 }, konec: { den: '2026-10-15', zlomek: 1 } });
    expect(r.zakazky.A.faze.kompletace).toMatchObject({
      start: { den: '2026-10-15', zlomek: 1 },
      konec: { den: '2026-10-16', zlomek: 1 },
      pripraveno: { den: UT, zlomek: 1 },
    });
    expect(r.zakazky.A.predpokladaneDokonceni).toEqual({ den: '2026-10-16', zlomek: 1 });
  });

  it('ve frontě jsou jen přiřazené zakázky s hodinami na dané fázi; neznámá čísla v ručním pořadí se ignorují', () => {
    const r = naplanuj({
      ...stav(
        [zakazka('A', { stroj1Hod: 8 }), zakazka('B', { stroj1Hod: 8, kompletaceHod: 4 }), zakazka('C', { stroj2Hod: 8 })],
        [
          { zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 },
          { zakazkaCislo: 'C', pripravarId: 'p2', poradi: 0 },
        ],
      ),
      poradiFaze: { stroj1: ['X', 'B', 'A', 'A'] },
    });
    expect(r.frontyFaze).toEqual({ stroj1: ['A'], stroj2: ['C'], stroj3: [], kompletace: [] });
    expect(r.zakazky.B.faze).toEqual({});
  });
});

describe('sestavFrontu', () => {
  const k = (cislo: string, den: string, terminDokonceni = '2026-10-30') => ({ cislo, pripraveno: { den, zlomek: 1 }, terminDokonceni });

  it('bez ručního pořadí řadí podle připravenosti, pak termínu dokončení a čísla', () => {
    expect(sestavFrontu([], [k('C', '2026-10-14'), k('B', PO, '2026-10-20'), k('A', PO, '2026-10-25')])).toEqual(['B', 'A', 'C']);
  });

  it('nová zakázka se vloží před první zakázku, která je připravená později', () => {
    const kandidati = [k('A', PO), k('C', '2026-10-16'), k('B', '2026-10-14')];
    expect(sestavFrontu(['A', 'C'], kandidati)).toEqual(['A', 'B', 'C']);
    // Ruční pořadí, které nejde podle připravenosti, zůstane; nová zakázka jde před první později připravenou.
    expect(sestavFrontu(['C', 'A'], kandidati)).toEqual(['B', 'C', 'A']);
    expect(sestavFrontu(['A', 'C'], [...kandidati, k('D', '2026-10-20')])).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('stav zakázky', () => {
  const termin = '2026-10-15'; // čtvrtek

  it('dokončení v den termínu = ok (rezerva 0)', () => {
    expect(urciStav({ den: termin, zlomek: 1 }, termin, 0)).toBe('ok');
  });

  it('s rezervou 1 den = ohrozeno', () => {
    expect(urciStav({ den: termin, zlomek: 0.5 }, termin, 1)).toBe('ohrozeno');
    expect(urciStav({ den: '2026-10-14', zlomek: 1 }, termin, 1)).toBe('ok');
  });

  it('den po termínu = pozde', () => {
    expect(urciStav({ den: '2026-10-16', zlomek: 0.1 }, termin, 0)).toBe('pozde');
    expect(urciStav({ den: '2026-10-16', zlomek: 0.1 }, termin, 1)).toBe('pozde');
  });

  it('bez dokončení = neprirazeno; rezerva počítá pracovní dny', () => {
    expect(urciStav(undefined, termin, 1)).toBe('neprirazeno');
    // termín po 19. 10., rezerva 1 pracovní den → hranice pá 16. 10.
    expect(urciStav({ den: '2026-10-16', zlomek: 1 }, '2026-10-19', 1)).toBe('ok');
    expect(urciStav({ den: '2026-10-19', zlomek: 0.2 }, '2026-10-19', 1)).toBe('ohrozeno');
  });

  it('naplanuj doplní stav i nepřiřazeným zakázkám', () => {
    const r = naplanuj(stav([zakazka('A'), zakazka('B')], [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }]));
    expect(r.zakazky.A.stav).toBe('ok');
    expect(r.zakazky.B.stav).toBe('neprirazeno');
    expect(r.zakazky.B.pripravarId).toBeUndefined();
    expect(r.zakazky.B.predpokladaneDokonceni).toBeUndefined();
  });
});

describe('nejpozdější start TPV', () => {
  const nastaveni: Nastaveni = { ...vychoziNastaveni(PO), hodDenStroj: { stroj1: 16, stroj2: 8, stroj3: 8, kompletace: 8 } };

  it('zpětný výpočet je inverzí dopředného', () => {
    const z = zakazka('A', { tpvHod: 8, stroj1Hod: 8, stroj2Hod: 16, stroj3Hod: 4, kompletaceHod: 8 });
    const dopredu = naplanuj({ ...stav([z], [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }]), nastaveni });
    const dokonceni = dopredu.zakazky.A.predpokladaneDokonceni!;
    // Zakázka s termínem přesně v den dopředného dokončení (konec dne) musí mít nejpozdější start = skutečný start.
    const zTermin = { ...z, terminDokonceni: dokonceni.den };
    expect(dokonceni.zlomek).toBe(1);
    expect(nejpozdejsiStart(zTermin, nastaveni).nejpozdejsiStartTpv).toBe(PO);
    expect(nejpozdejsiStart(zTermin, nastaveni).nestihnutelne).toBe(false);
  });

  it('nestihnutelné, když je nejpozdější start před začátkem plánu nebo termínem zadání', () => {
    const z = zakazka('A', { tpvHod: 40, terminDokonceni: '2026-10-15' });
    expect(nejpozdejsiStart(z, nastaveni)).toEqual({ nejpozdejsiStartTpv: '2026-10-09', nestihnutelne: true });
    const z2 = zakazka('B', { tpvHod: 8, terminZadani: '2026-10-20', terminDokonceni: '2026-10-19' });
    expect(nejpozdejsiStart(z2, nastaveni)).toEqual({ nejpozdejsiStartTpv: '2026-10-19', nestihnutelne: true });
    const z3 = zakazka('C', { tpvHod: 8, terminDokonceni: '2026-10-19' });
    expect(nejpozdejsiStart(z3, nastaveni).nestihnutelne).toBe(false);
  });
});

describe('vytížení', () => {
  it('40 h v týdnu bez svátku = 100 %', () => {
    const r = naplanuj(stav([zakazka('A', { tpvHod: 40 })], [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }]));
    expect(r.vytizeni.p1).toEqual({ '2026-W42': 40 });
    expect(dostupneHodinyVTydnu('2026-W42', 8)).toBe(40);
  });

  it('v týdnu se svátkem je dostupných 32 h a hodiny se přelévají dál', () => {
    expect(dostupneHodinyVTydnu('2026-W44', 8)).toBe(32);
    const r = naplanuj(
      stav([zakazka('A', { tpvHod: 36 })], [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }], { zacatekPlanu: '2026-10-26' }),
    );
    expect(r.vytizeni.p1).toEqual({ '2026-W44': 32, '2026-W45': 4 });
  });

  it('hodiny po dnech respektují zlomky a součet odpovídá hodinám fáze', () => {
    const rozdeleni = hodinyPoDnech({ start: { den: PO, zlomek: 0.5 }, konec: { den: '2026-10-14', zlomek: 0.25 }, hodiny: 14 }, 8);
    expect(rozdeleni).toEqual({ [PO]: 4, [UT]: 8, '2026-10-14': 2 });
    expect(Object.values(rozdeleni).reduce((a, b) => a + b, 0)).toBe(14);
  });

  it('fáze začínající koncem dne se započte až do dalšího dne', () => {
    expect(hodinyPoDnech({ start: { den: PO, zlomek: 1 }, konec: { den: UT, zlomek: 0.5 }, hodiny: 4 }, 8)).toEqual({ [UT]: 4 });
  });
});
