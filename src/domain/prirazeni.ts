// Čisté operace nad přiřazeními (přesun drag & drop, odebrání) a nad frontami strojů a kompletace.
// Pořadí ve frontách přípravářů se vždy přečísluje od 0.

import type { PoradiFaze, Prirazeni } from './types';

/** Přečísluje pořadí v každé frontě od 0 podle stávajícího pořadí (stabilně). */
export function precislujFronty(prirazeni: Prirazeni[]): Prirazeni[] {
  const citace = new Map<string, number>();
  return [...prirazeni]
    .sort((a, b) => a.pripravarId.localeCompare(b.pripravarId) || a.poradi - b.poradi)
    .map((p) => {
      const poradi = citace.get(p.pripravarId) ?? 0;
      citace.set(p.pripravarId, poradi + 1);
      return { ...p, poradi };
    });
}

/** Čísla zakázek ve frontě přípraváře seřazená podle pořadí. */
export function frontaPripravare(prirazeni: Prirazeni[], pripravarId: string): string[] {
  return prirazeni
    .filter((p) => p.pripravarId === pripravarId)
    .sort((a, b) => a.poradi - b.poradi)
    .map((p) => p.zakazkaCislo);
}

/**
 * Přesune zakázku: `pripravarId = null` = do zásobníku; jinak do fronty přípraváře na pozici `index`
 * (index v cílové frontě po odebrání přesouvané zakázky; mimo rozsah = na konec).
 */
export function presunZakazku(
  prirazeni: Prirazeni[],
  cislo: string,
  pripravarId: string | null,
  index = Number.MAX_SAFE_INTEGER,
): Prirazeni[] {
  const bez = prirazeni.filter((p) => p.zakazkaCislo !== cislo);
  if (pripravarId === null) return precislujFronty(bez);

  const fronta = frontaPripravare(bez, pripravarId);
  const pozice = Math.max(0, Math.min(index, fronta.length));
  fronta.splice(pozice, 0, cislo);
  const novePoradi = new Map(fronta.map((c, i) => [c, i]));

  const ostatni = bez.filter((p) => p.pripravarId !== pripravarId);
  const nova = fronta.map((c) => ({ zakazkaCislo: c, pripravarId, poradi: novePoradi.get(c)! }));
  return precislujFronty([...ostatni, ...nova]);
}

/**
 * Přesune zakázku ve frontě stroje / kompletace na pozici `index` (index po odebrání přesouvané zakázky; mimo rozsah = na konec).
 * Vstupem je výsledná fronta z rozvrhu; výstup se uloží jako ruční pořadí fáze.
 */
export function presunVeFronteFaze(fronta: readonly string[], cislo: string, index = Number.MAX_SAFE_INTEGER): string[] {
  const bez = fronta.filter((c) => c !== cislo);
  bez.splice(Math.max(0, Math.min(index, bez.length)), 0, cislo);
  return bez;
}

/** Odebere zakázku z ručního pořadí všech front (po vrácení do zásobníku se při novém přiřazení zařadí podle připravenosti). */
export function odeberZFrontFaze<T extends Partial<PoradiFaze>>(poradi: T, cislo: string): T {
  return Object.fromEntries(Object.entries(poradi).map(([faze, fronta]) => [faze, (fronta ?? []).filter((c) => c !== cislo)])) as T;
}
