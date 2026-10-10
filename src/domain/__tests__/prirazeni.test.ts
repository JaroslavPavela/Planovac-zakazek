import { describe, it, expect } from 'vitest';
import { frontaPripravare, presunZakazku } from '../prirazeni';
import type { Prirazeni } from '../types';

const vychozi: Prirazeni[] = [
  { zakazkaCislo: 'A', pripravarId: 'p1', poradi: 0 },
  { zakazkaCislo: 'B', pripravarId: 'p1', poradi: 1 },
  { zakazkaCislo: 'C', pripravarId: 'p1', poradi: 2 },
  { zakazkaCislo: 'D', pripravarId: 'p2', poradi: 0 },
];

describe('presunZakazku', () => {
  it('ze zásobníku do sloupce na pozici i na konec', () => {
    expect(frontaPripravare(presunZakazku(vychozi, 'X', 'p1', 1), 'p1')).toEqual(['A', 'X', 'B', 'C']);
    expect(frontaPripravare(presunZakazku(vychozi, 'X', 'p1'), 'p1')).toEqual(['A', 'B', 'C', 'X']);
    expect(frontaPripravare(presunZakazku(vychozi, 'X', 'p3', 0), 'p3')).toEqual(['X']);
  });

  it('v rámci sloupce dolů i nahoru (sémantika arrayMove)', () => {
    expect(frontaPripravare(presunZakazku(vychozi, 'A', 'p1', 2), 'p1')).toEqual(['B', 'C', 'A']);
    expect(frontaPripravare(presunZakazku(vychozi, 'C', 'p1', 0), 'p1')).toEqual(['C', 'A', 'B']);
  });

  it('mezi sloupci a do zásobníku, pořadí se přečísluje', () => {
    const doP2 = presunZakazku(vychozi, 'B', 'p2', 0);
    expect(frontaPripravare(doP2, 'p1')).toEqual(['A', 'C']);
    expect(frontaPripravare(doP2, 'p2')).toEqual(['B', 'D']);
    expect(doP2.find((p) => p.zakazkaCislo === 'C')!.poradi).toBe(1);

    const doZasobniku = presunZakazku(vychozi, 'A', null);
    expect(doZasobniku.find((p) => p.zakazkaCislo === 'A')).toBeUndefined();
    expect(doZasobniku.filter((p) => p.pripravarId === 'p1').map((p) => p.poradi)).toEqual([0, 1]);
    expect(vychozi).toHaveLength(4); // vstup se nemění
  });
});

