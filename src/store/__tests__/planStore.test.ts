import { describe, it, expect, beforeEach } from 'vitest';
import { migrujUlozenyStav, usePlanStore } from '../planStore';
import type { Zakazka } from '../../domain/types';

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
    expect(novy.poradiFaze).toEqual({ stroj1: [], stroj2: [], stroj3: [], kompletace: [] });
  });

  it('verze 2: doplní prázdné pořadí front; verze 3: pořadí zachová a neplatné hodnoty vyřadí', () => {
    expect(migrujUlozenyStav({ prirazeni: [] }, 2).poradiFaze).toEqual({ stroj1: [], stroj2: [], stroj3: [], kompletace: [] });
    const v3 = migrujUlozenyStav({ poradiFaze: { stroj1: ['B', 'A', 7], stroj3: 'x', kompletace: ['A'] } }, 3);
    expect(v3.poradiFaze).toEqual({ stroj1: ['B', 'A'], stroj2: [], stroj3: [], kompletace: ['A'] });
  });
});

describe('store — fronty strojů a kompletace', () => {
  const zakazka = (cislo: string): Zakazka => ({
    cislo,
    nazev: cislo,
    firma: 'Firma',
    tpvHod: 8,
    stroj1Hod: 8,
    stroj2Hod: 0,
    stroj3Hod: 0,
    kompletaceHod: 4,
    terminZadani: '2026-10-12',
    terminDokonceni: '2026-10-30',
  });
  const s = () => usePlanStore.getState();

  beforeEach(() => {
    s().vymazVse();
    s().upravNastaveni({ zacatekPlanu: '2026-10-12' });
    s().nahradData([zakazka('A'), zakazka('B')], [
      { zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 },
      { zakazkaCislo: 'B', pripravarId: 'p2', poradi: 0 },
    ]);
  });

  it('přesun ve frontě uloží celé výsledné pořadí a jde vrátit Zpět / Znovu', () => {
    s().presunVeFronte('stroj1', 'B', 0);
    expect(s().poradiFaze.stroj1).toEqual(['B', 'A']);
    expect(s().poradiFaze.kompletace).toEqual([]);
    expect(s().minulost).toHaveLength(1);
    s().zpet();
    expect(s().poradiFaze.stroj1).toEqual([]);
    s().znovu();
    expect(s().poradiFaze.stroj1).toEqual(['B', 'A']);
  });

  it('přesun beze změny pořadí ani přesun zakázky mimo frontu nevytvoří položku historie', () => {
    s().presunVeFronte('stroj1', 'A', 0); // automatické pořadí už je A, B
    s().presunVeFronte('stroj2', 'A', 0); // A na stroji 2 nemá hodiny
    expect(s().minulost).toHaveLength(0);
    expect(s().poradiFaze.stroj1).toEqual([]);
  });

  it('seřazení podle připravenosti vyprázdní ruční pořadí fronty', () => {
    s().presunVeFronte('kompletace', 'B', 0);
    expect(s().poradiFaze.kompletace).toEqual(['B', 'A']);
    s().seradFrontuFaze('kompletace');
    expect(s().poradiFaze.kompletace).toEqual([]);
    expect(s().minulost).toHaveLength(2);
  });

  it('vrácení do zásobníku odebere zakázku z ručního pořadí front; Zpět vrátí obojí', () => {
    s().presunVeFronte('stroj1', 'B', 0);
    s().presunZakazku('B', null);
    expect(s().prirazeni.map((p) => p.zakazkaCislo)).toEqual(['A']);
    expect(s().poradiFaze.stroj1).toEqual(['A']);
    s().zpet();
    expect(s().prirazeni).toHaveLength(2);
    expect(s().poradiFaze.stroj1).toEqual(['B', 'A']);
  });

  it('přesun k jinému přípraváři ruční pořadí front zachová; import ho nahradí', () => {
    s().presunVeFronte('stroj1', 'B', 0);
    s().presunZakazku('B', 'p1', 0);
    expect(s().poradiFaze.stroj1).toEqual(['B', 'A']);
    s().nahradData([zakazka('A')], [], { stroj1: ['A'], stroj2: [], stroj3: [], kompletace: [] });
    expect(s().poradiFaze.stroj1).toEqual(['A']);
    expect(s().minulost).toHaveLength(0);
  });
});
