import { describe, it, expect } from 'vitest';
import { migrujUlozenyStav } from '../planStore';

describe('migrujUlozenyStav', () => {
  it('verze 0: přejmenuje stroje frezka1/frezka2/vysekavacka na stroj1–3 v zakázkách i nastavení', () => {
    const stary = {
      zakazky: [{ cislo: 'A', tpvHod: 1, frezka1Hod: 2, frezka2Hod: 3, vysekavackaHod: 4, kompletaceHod: 5 }],
      pripravari: [{ id: 'p1', nazev: 'Jana' }],
      prirazeni: [{ zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 }],
      nastaveni: { zacatekPlanu: '2026-10-12', rezervaDny: 2, hodDenPripravar: 7, hodDenStroj: { frezka1: 16, frezka2: 8, vysekavacka: 12, kompletace: 8 } },
    };
    const novy = migrujUlozenyStav(stary, 0);
    expect(novy.zakazky[0]).toMatchObject({ cislo: 'A', stroj1Hod: 2, stroj2Hod: 3, stroj3Hod: 4, kompletaceHod: 5 });
    expect(novy.zakazky[0]).not.toHaveProperty('frezka1Hod');
    expect(novy.nastaveni.hodDenStroj).toEqual({ stroj1: 16, stroj2: 8, stroj3: 12, kompletace: 8 });
    expect(novy.nastaveni.nazvyStroju).toEqual({ stroj1: 'Stroj 1', stroj2: 'Stroj 2', stroj3: 'Stroj 3' });
    expect(novy.nastaveni.rezervaDny).toBe(2);
    expect(novy.pripravari[0].nazev).toBe('Jana');
    expect(novy.prirazeni).toHaveLength(1);
  });

  it('verze 1: doplní výchozí názvy strojů, vlastní názvy zachová', () => {
    const v1 = { nastaveni: { nazvyStroju: { stroj2: 'Laser' } } };
    expect(migrujUlozenyStav(v1, 1).nastaveni.nazvyStroju).toEqual({ stroj1: 'Stroj 1', stroj2: 'Laser', stroj3: 'Stroj 3' });
  });

  it('prázdné nebo neúplné úložiště doplní výchozími hodnotami', () => {
    const novy = migrujUlozenyStav({}, 0);
    expect(novy.zakazky).toEqual([]);
    expect(novy.pripravari).toHaveLength(6);
    expect(novy.nastaveni.hodDenStroj).toEqual({ stroj1: 8, stroj2: 8, stroj3: 8, kompletace: 8 });
  });
});
