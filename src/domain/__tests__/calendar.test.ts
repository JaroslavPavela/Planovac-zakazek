import { describe, it, expect } from 'vitest';
import {
  dalsiPracovniDen,
  denVTydnu,
  isoTyden,
  jePracovniDen,
  jeSvatek,
  naPracovniDen,
  odectiHodiny,
  pocetPracovnichDnu,
  pondeliTydne,
  porovnej,
  posunPracovniDny,
  pracovniDnyVTydnu,
  predchoziPracovniDen,
  pridejHodiny,
  svatky,
  velikonocniNedele,
} from '../calendar';

// Říjen 2026: po 12. 10., út 13., st 14., čt 15., pá 16., po 19., út 20.; st 28. 10. je svátek.
const PO = '2026-10-12';
const UT = '2026-10-13';
const PA = '2026-10-16';

describe('svátky', () => {
  it('Velikonoce výpočtem pro více let', () => {
    expect(velikonocniNedele(2024)).toBe('2024-03-31');
    expect(velikonocniNedele(2025)).toBe('2025-04-20');
    expect(velikonocniNedele(2026)).toBe('2026-04-05');
    expect(velikonocniNedele(2027)).toBe('2027-03-28');
  });

  it('Velký pátek a Velikonoční pondělí 2026', () => {
    expect(jeSvatek('2026-04-03')).toBe(true);
    expect(jeSvatek('2026-04-06')).toBe(true);
    expect(jeSvatek('2026-04-07')).toBe(false);
  });

  it('pevné svátky', () => {
    expect(svatky(2026)).toHaveLength(13);
    for (const d of ['2026-01-01', '2026-05-01', '2026-05-08', '2026-07-05', '2026-07-06', '2026-09-28', '2026-10-28', '2026-11-17', '2026-12-24', '2026-12-25', '2026-12-26']) {
      expect(jeSvatek(d), d).toBe(true);
    }
  });
});

describe('pracovní dny', () => {
  it('den v týdnu a pracovní den', () => {
    expect(denVTydnu(PO)).toBe(1);
    expect(denVTydnu('2026-10-18')).toBe(7);
    expect(jePracovniDen(PO)).toBe(true);
    expect(jePracovniDen('2026-10-17')).toBe(false); // sobota
    expect(jePracovniDen('2026-10-28')).toBe(false); // svátek
  });

  it('posuny přes víkend a svátek', () => {
    expect(dalsiPracovniDen(PA)).toBe('2026-10-19');
    expect(dalsiPracovniDen('2026-10-27')).toBe('2026-10-29');
    expect(predchoziPracovniDen('2026-10-19')).toBe(PA);
    expect(predchoziPracovniDen('2026-10-29')).toBe('2026-10-27');
    expect(naPracovniDen('2026-10-17')).toBe('2026-10-19');
    expect(naPracovniDen(PO)).toBe(PO);
    expect(posunPracovniDny('2026-10-29', -2)).toBe('2026-10-26');
    expect(posunPracovniDny(PA, 1)).toBe('2026-10-19');
  });

  it('počet pracovních dnů v intervalu', () => {
    expect(pocetPracovnichDnu(PO, '2026-10-18')).toBe(5);
    expect(pocetPracovnichDnu('2026-10-26', '2026-11-01')).toBe(4);
    expect(pocetPracovnichDnu(UT, PO)).toBe(0);
  });
});

describe('pridejHodiny', () => {
  it('12 h TPV (8 h/den) od pondělí → úterý 0,5', () => {
    expect(pridejHodiny({ den: PO, zlomek: 0 }, 12, 8)).toEqual({ den: UT, zlomek: 0.5 });
  });

  it('20 h TPV od pátku → úterý 0,5 (víkend přeskočen)', () => {
    expect(pridejHodiny({ den: PA, zlomek: 0 }, 20, 8)).toEqual({ den: '2026-10-20', zlomek: 0.5 });
  });

  it('fáze přes svátek 28. 10. se o den prodlouží', () => {
    // 24 h od út 27. 10.: út, (st svátek), čt, pá
    expect(pridejHodiny({ den: '2026-10-27', zlomek: 0 }, 24, 8)).toEqual({ den: '2026-10-30', zlomek: 1 });
    expect(pridejHodiny({ den: '2026-10-20', zlomek: 0 }, 24, 8)).toEqual({ den: '2026-10-22', zlomek: 1 });
  });

  it('kapacita stroje: 16 h/den, 8 h → 0,5 dne; 8 h/den → 1 den', () => {
    expect(pridejHodiny({ den: PO, zlomek: 0 }, 8, 16)).toEqual({ den: PO, zlomek: 0.5 });
    expect(pridejHodiny({ den: PO, zlomek: 0 }, 8, 8)).toEqual({ den: PO, zlomek: 1 });
  });

  it('navazuje na konec dne a na nepracovní den', () => {
    expect(pridejHodiny({ den: PO, zlomek: 1 }, 4, 8)).toEqual({ den: UT, zlomek: 0.5 });
    expect(pridejHodiny({ den: '2026-10-17', zlomek: 0 }, 4, 8)).toEqual({ den: '2026-10-19', zlomek: 0.5 });
  });

  it('0 h → konec = start', () => {
    const start = { den: PO, zlomek: 0.25 };
    expect(pridejHodiny(start, 0, 8)).toBe(start);
  });

  it('zlomky se sčítají bez chyb plovoucí čárky', () => {
    let cas = { den: PO, zlomek: 0 };
    for (let i = 0; i < 10; i++) cas = pridejHodiny(cas, 0.8, 8);
    expect(cas).toEqual({ den: PO, zlomek: 1 });
  });
});

describe('odectiHodiny', () => {
  it('je inverzí pridejHodiny', () => {
    const starty = [
      { den: PO, zlomek: 0 },
      { den: UT, zlomek: 0.5 },
      { den: PA, zlomek: 0.25 },
    ];
    for (const start of starty) {
      for (const hod of [4, 8, 12, 20, 37.5]) {
        const konec = pridejHodiny(start, hod, 8);
        expect(odectiHodiny(konec, hod, 8), `${start.den} ${start.zlomek} +${hod}`).toEqual(start);
      }
    }
  });

  it('zpětně přes víkend a svátek', () => {
    expect(odectiHodiny({ den: '2026-10-20', zlomek: 0.5 }, 20, 8)).toEqual({ den: PA, zlomek: 0 });
    expect(odectiHodiny({ den: '2026-10-30', zlomek: 1 }, 24, 8)).toEqual({ den: '2026-10-27', zlomek: 0 });
  });

  it('konec na nepracovní den se bere jako konec předchozího pracovního dne', () => {
    expect(odectiHodiny({ den: '2026-10-18', zlomek: 1 }, 8, 8)).toEqual({ den: PA, zlomek: 0 });
  });
});

describe('porovnání a ISO týdny', () => {
  it('porovnej', () => {
    expect(porovnej({ den: PO, zlomek: 0.5 }, { den: PO, zlomek: 0.5 })).toBe(0);
    expect(porovnej({ den: PO, zlomek: 1 }, { den: UT, zlomek: 0 })).toBeLessThan(0);
    expect(porovnej({ den: PO, zlomek: 0.75 }, { den: PO, zlomek: 0.5 })).toBeGreaterThan(0);
  });

  it('isoTyden a pondeliTydne', () => {
    expect(isoTyden(PO)).toBe('2026-W42');
    expect(isoTyden('2026-10-18')).toBe('2026-W42');
    expect(isoTyden('2026-01-01')).toBe('2026-W01');
    expect(isoTyden('2027-01-01')).toBe('2026-W53');
    expect(isoTyden('2024-12-30')).toBe('2025-W01');
    expect(pondeliTydne('2026-W42')).toBe(PO);
    expect(pondeliTydne('2025-W01')).toBe('2024-12-30');
  });

  it('pracovní dny v týdnu zohledňují svátek', () => {
    expect(pracovniDnyVTydnu('2026-W42')).toHaveLength(5);
    expect(pracovniDnyVTydnu('2026-W44')).toEqual(['2026-10-26', '2026-10-27', '2026-10-29', '2026-10-30']);
  });
});
