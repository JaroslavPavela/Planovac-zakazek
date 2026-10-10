// Navrhnout rozdělení (5.5) a seřazení fronty podle termínu (5.6). Čisté funkce vracející nová přiřazení.

import { porovnej } from './calendar';
import { naplanuj } from './scheduler';
import type { Prirazeni, StavAplikace, Zakazka } from './types';

function podleTerminu(a: Zakazka, b: Zakazka): number {
  return (
    a.terminDokonceni.localeCompare(b.terminDokonceni) ||
    a.terminZadani.localeCompare(b.terminZadani) ||
    a.cislo.localeCompare(b.cislo)
  );
}

/**
 * Hladově přiřadí všechny nepřiřazené zakázky: nejdřív nejbližší termín, vždy přípraváři s nejdřívějším
 * koncem fronty (při shodě nižší index). Stávající přiřazení zůstávají beze změny.
 */
export function navrhniRozdeleni(stav: StavAplikace): Prirazeni[] {
  if (stav.pripravari.length === 0) return stav.prirazeni;
  const prirazeno = new Set(stav.prirazeni.map((p) => p.zakazkaCislo));
  const zasobnik = stav.zakazky.filter((z) => !prirazeno.has(z.cislo)).sort(podleTerminu);

  let prirazeni = [...stav.prirazeni];
  for (const zakazka of zasobnik) {
    const rozvrh = naplanuj({ ...stav, prirazeni });
    let vybrany = stav.pripravari[0];
    for (const p of stav.pripravari.slice(1)) {
      if (porovnej(rozvrh.konecFronty[p.id], rozvrh.konecFronty[vybrany.id]) < 0) vybrany = p;
    }
    const poradi = prirazeni
      .filter((p) => p.pripravarId === vybrany.id)
      .reduce((m, p) => Math.max(m, p.poradi + 1), 0);
    prirazeni = [...prirazeni, { zakazkaCislo: zakazka.cislo, pripravarId: vybrany.id, poradi }];
  }
  return prirazeni;
}

/** Přečísluje pořadí ve frontě přípraváře podle termínu dokončení (sekundárně termínu zadání). */
export function seradFrontuPodleTerminu(stav: StavAplikace, pripravarId: string): Prirazeni[] {
  const zakazky = new Map(stav.zakazky.map((z) => [z.cislo, z]));
  const fronta = stav.prirazeni
    .filter((p) => p.pripravarId === pripravarId && zakazky.has(p.zakazkaCislo))
    .sort((a, b) => podleTerminu(zakazky.get(a.zakazkaCislo)!, zakazky.get(b.zakazkaCislo)!));
  const novePoradi = new Map(fronta.map((p, i) => [p.zakazkaCislo, i]));
  return stav.prirazeni.map((p) =>
    novePoradi.has(p.zakazkaCislo) ? { ...p, poradi: novePoradi.get(p.zakazkaCislo)! } : p,
  );
}
