// Dopředný plánovač podle sekce 5 specifikace — čistá funkce naplanuj(stav): Rozvrh.

import { dalsiPracovniDen, isoTyden, jePracovniDen, max, naPracovniDen, porovnej, pracovniDnyVTydnu, pridejHodiny } from './calendar';
import { nejpozdejsiStart, urciStav } from './risk';
import { FAZE, NAVAZUJICI_FAZE, STROJE, hodinyFaze, prazdnePoradiFaze } from './types';
import type { FazeId, FazeRozvrh, NavazujiciFaze, Nastaveni, PracovniCas, Rozvrh, RozvrhZakazky, StavAplikace, Zakazka } from './types';

export interface PlanTpv {
  tpv?: FazeRozvrh; // jen při TPV > 0
  konecTpv: PracovniCas;
}

/** Začátek fronty: první pracovní den od začátku plánu. */
export function zacatekFronty(nastaveni: Nastaveni): PracovniCas {
  return { den: naPracovniDen(nastaveni.zacatekPlanu), zlomek: 0 };
}

/** Naplánuje TPV zakázky od kurzoru přípraváře (5.1, kroky 1–2). */
export function naplanujTpv(zakazka: Zakazka, kurzor: PracovniCas, nastaveni: Nastaveni): PlanTpv {
  const nejdrivejsiDen =
    zakazka.terminZadani > nastaveni.zacatekPlanu ? zakazka.terminZadani : nastaveni.zacatekPlanu;
  const startTpv = max(kurzor, { den: naPracovniDen(nejdrivejsiDen), zlomek: 0 });
  const konecTpv = pridejHodiny(startTpv, zakazka.tpvHod, nastaveni.hodDenPripravar);
  return zakazka.tpvHod > 0 ? { tpv: { start: startTpv, konec: konecTpv, hodiny: zakazka.tpvHod }, konecTpv } : { konecTpv };
}

export interface KandidatFronty {
  cislo: string;
  pripraveno: PracovniCas;
  terminDokonceni: string;
}

function podlePripravenosti(a: KandidatFronty, b: KandidatFronty): number {
  return porovnej(a.pripraveno, b.pripraveno) || a.terminDokonceni.localeCompare(b.terminDokonceni) || a.cislo.localeCompare(b.cislo);
}

/**
 * Výsledné pořadí fronty stroje / kompletace (5.7): ruční pořadí zakázek, které do fronty patří (ostatní se vynechají);
 * zakázky v ručním pořadí chybějící se vloží podle připravenosti — před první zakázku, která je připravená později.
 */
export function sestavFrontu(rucni: readonly string[], kandidati: readonly KandidatFronty[]): string[] {
  const podleCisla = new Map(kandidati.map((k) => [k.cislo, k]));
  const fronta = [...new Set(rucni.filter((c) => podleCisla.has(c)))];
  const zarazene = new Set(fronta);
  const nove = kandidati.filter((k) => !zarazene.has(k.cislo)).sort(podlePripravenosti);
  for (const k of nove) {
    const pozice = fronta.findIndex((c) => porovnej(podleCisla.get(c)!.pripraveno, k.pripraveno) > 0);
    fronta.splice(pozice < 0 ? fronta.length : pozice, 0, k.cislo);
  }
  return fronta;
}

/** Rozdělí hodiny fáze po pracovních dnech (ISO den → hodiny) podle zlomků dne × hodDen. */
export function hodinyPoDnech(faze: FazeRozvrh, hodDen: number): Record<string, number> {
  const vysledek: Record<string, number> = {};
  let den = faze.start.den;
  let zlomekStart = faze.start.zlomek;
  if (!jePracovniDen(den) || zlomekStart >= 1) {
    den = dalsiPracovniDen(den);
    zlomekStart = 0;
  }
  while (den <= faze.konec.den) {
    const od = den === faze.start.den ? zlomekStart : 0;
    const doZlomku = den === faze.konec.den ? faze.konec.zlomek : 1;
    const hodiny = (doZlomku - od) * hodDen;
    if (hodiny > 0) vysledek[den] = Math.round(hodiny * 1e6) / 1e6;
    den = dalsiPracovniDen(den);
  }
  return vysledek;
}

/** Dostupné hodiny přípraváře v ISO týdnu (pracovní dny × hodDen). */
export function dostupneHodinyVTydnu(tyden: string, hodDen: number): number {
  return pracovniDnyVTydnu(tyden).length * hodDen;
}

export function naplanuj(stav: StavAplikace): Rozvrh {
  const { zakazky, pripravari, prirazeni, nastaveni } = stav;
  const zakazkyPodleCisla = new Map(zakazky.map((z) => [z.cislo, z]));
  const konecFronty: Record<string, PracovniCas> = {};
  const vytizeni: Record<string, Record<string, number>> = {};
  const frontyFaze = prazdnePoradiFaze();

  // 5.1 — TPV ve frontách přípravářů.
  const naplanovane = new Map<string, { pripravarId: string; konecTpv: PracovniCas; faze: Partial<Record<FazeId, FazeRozvrh>> }>();
  for (const pripravar of pripravari) {
    let kurzor = zacatekFronty(nastaveni);
    const tydny: Record<string, number> = {};
    const fronta = prirazeni
      .filter((p) => p.pripravarId === pripravar.id && zakazkyPodleCisla.has(p.zakazkaCislo))
      .sort((a, b) => a.poradi - b.poradi);

    for (const polozka of fronta) {
      if (naplanovane.has(polozka.zakazkaCislo)) continue; // duplicitní přiřazení — platí první
      const zakazka = zakazkyPodleCisla.get(polozka.zakazkaCislo)!;
      const plan = naplanujTpv(zakazka, kurzor, nastaveni);
      kurzor = plan.konecTpv;

      if (plan.tpv) {
        for (const [den, hodiny] of Object.entries(hodinyPoDnech(plan.tpv, nastaveni.hodDenPripravar))) {
          const tyden = isoTyden(den);
          tydny[tyden] = Math.round(((tydny[tyden] ?? 0) + hodiny) * 1e6) / 1e6;
        }
      }
      naplanovane.set(zakazka.cislo, { pripravarId: pripravar.id, konecTpv: plan.konecTpv, faze: plan.tpv ? { tpv: plan.tpv } : {} });
    }

    konecFronty[pripravar.id] = kurzor;
    vytizeni[pripravar.id] = tydny;
  }

  // 5.7 — stroje a kompletace ve vlastních frontách; zakázka čeká na předchozí fázi i na předchozí zakázku ve frontě.
  const konecStroju = (cislo: string): PracovniCas => {
    const n = naplanovane.get(cislo)!;
    return STROJE.reduce((m, s) => (n.faze[s] ? max(m, n.faze[s]!.konec) : m), n.konecTpv);
  };
  const naplanujFrontu = (faze: NavazujiciFaze, pripraveno: (cislo: string) => PracovniCas) => {
    const kandidati = zakazky
      .filter((z) => naplanovane.has(z.cislo) && hodinyFaze(z, faze) > 0)
      .map((z) => ({ cislo: z.cislo, pripraveno: pripraveno(z.cislo), terminDokonceni: z.terminDokonceni }));
    const pripravenoPodleCisla = new Map(kandidati.map((k) => [k.cislo, k.pripraveno]));
    const fronta = sestavFrontu(stav.poradiFaze?.[faze] ?? [], kandidati);
    let kurzor = zacatekFronty(nastaveni);
    for (const cislo of fronta) {
      const hodiny = hodinyFaze(zakazkyPodleCisla.get(cislo)!, faze);
      const pripravenoFaze = pripravenoPodleCisla.get(cislo)!;
      const start = max(kurzor, pripravenoFaze);
      const konec = pridejHodiny(start, hodiny, nastaveni.hodDenStroj[faze]);
      naplanovane.get(cislo)!.faze[faze] = { start, konec, hodiny, pripraveno: pripravenoFaze };
      kurzor = konec;
    }
    frontyFaze[faze] = fronta;
  };
  for (const faze of NAVAZUJICI_FAZE) {
    naplanujFrontu(faze, faze === 'kompletace' ? konecStroju : (cislo) => naplanovane.get(cislo)!.konecTpv);
  }

  const vysledek: Record<string, RozvrhZakazky> = {};
  for (const zakazka of zakazky) {
    const n = naplanovane.get(zakazka.cislo);
    if (!n) {
      vysledek[zakazka.cislo] = { cislo: zakazka.cislo, faze: {}, stav: 'neprirazeno', ...nejpozdejsiStart(zakazka, nastaveni) };
      continue;
    }
    // Fáze v pevném pořadí TPV → stroje → kompletace (jen fáze s hodinami > 0).
    const faze: Partial<Record<FazeId, FazeRozvrh>> = {};
    for (const f of FAZE) if (n.faze[f]) faze[f] = n.faze[f];
    const predpokladaneDokonceni = faze.kompletace?.konec ?? konecStroju(zakazka.cislo);
    vysledek[zakazka.cislo] = {
      cislo: zakazka.cislo,
      pripravarId: n.pripravarId,
      faze,
      predpokladaneDokonceni,
      stav: urciStav(predpokladaneDokonceni, zakazka.terminDokonceni, nastaveni.rezervaDny),
      ...nejpozdejsiStart(zakazka, nastaveni),
    };
  }

  return { zakazky: vysledek, konecFronty, vytizeni, frontyFaze };
}
