// Dopředný plánovač podle sekce 5 specifikace — čistá funkce naplanuj(stav): Rozvrh.

import { dalsiPracovniDen, isoTyden, jePracovniDen, max, naPracovniDen, pracovniDnyVTydnu, pridejHodiny } from './calendar';
import { nejpozdejsiStart, urciStav } from './risk';
import { STROJE, hodinyFaze } from './types';
import type { FazeId, FazeRozvrh, Nastaveni, PracovniCas, Rozvrh, RozvrhZakazky, StavAplikace, Zakazka } from './types';

export interface RozvrhFazi {
  faze: Partial<Record<FazeId, FazeRozvrh>>;
  konecTpv: PracovniCas;
  predpokladaneDokonceni: PracovniCas;
}

/** Začátek fronty: první pracovní den od začátku plánu. */
export function zacatekFronty(nastaveni: Nastaveni): PracovniCas {
  return { den: naPracovniDen(nastaveni.zacatekPlanu), zlomek: 0 };
}

/** Naplánuje fáze jedné zakázky od kurzoru přípraváře (5.1, kroky 1–6). */
export function naplanujZakazku(zakazka: Zakazka, kurzor: PracovniCas, nastaveni: Nastaveni): RozvrhFazi {
  const nejdrivejsiDen =
    zakazka.terminZadani > nastaveni.zacatekPlanu ? zakazka.terminZadani : nastaveni.zacatekPlanu;
  const startTpv = max(kurzor, { den: naPracovniDen(nejdrivejsiDen), zlomek: 0 });
  const konecTpv = pridejHodiny(startTpv, zakazka.tpvHod, nastaveni.hodDenPripravar);

  const faze: Partial<Record<FazeId, FazeRozvrh>> = {};
  if (zakazka.tpvHod > 0) faze.tpv = { start: startTpv, konec: konecTpv, hodiny: zakazka.tpvHod };

  let konecStroju = konecTpv;
  for (const stroj of STROJE) {
    const hod = hodinyFaze(zakazka, stroj);
    if (hod > 0) {
      const konec = pridejHodiny(konecTpv, hod, nastaveni.hodDenStroj[stroj]);
      faze[stroj] = { start: konecTpv, konec, hodiny: hod };
      konecStroju = max(konecStroju, konec);
    }
  }

  let predpokladaneDokonceni = konecStroju;
  if (zakazka.kompletaceHod > 0) {
    const konec = pridejHodiny(konecStroju, zakazka.kompletaceHod, nastaveni.hodDenStroj.kompletace);
    faze.kompletace = { start: konecStroju, konec, hodiny: zakazka.kompletaceHod };
    predpokladaneDokonceni = konec;
  }

  return { faze, konecTpv, predpokladaneDokonceni };
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
  const vysledek: Record<string, RozvrhZakazky> = {};
  const konecFronty: Record<string, PracovniCas> = {};
  const vytizeni: Record<string, Record<string, number>> = {};

  for (const pripravar of pripravari) {
    let kurzor = zacatekFronty(nastaveni);
    const tydny: Record<string, number> = {};
    const fronta = prirazeni
      .filter((p) => p.pripravarId === pripravar.id && zakazkyPodleCisla.has(p.zakazkaCislo))
      .sort((a, b) => a.poradi - b.poradi);

    for (const polozka of fronta) {
      if (vysledek[polozka.zakazkaCislo]) continue; // duplicitní přiřazení — platí první
      const zakazka = zakazkyPodleCisla.get(polozka.zakazkaCislo)!;
      const plan = naplanujZakazku(zakazka, kurzor, nastaveni);
      kurzor = plan.konecTpv;

      if (plan.faze.tpv) {
        for (const [den, hodiny] of Object.entries(hodinyPoDnech(plan.faze.tpv, nastaveni.hodDenPripravar))) {
          const tyden = isoTyden(den);
          tydny[tyden] = Math.round(((tydny[tyden] ?? 0) + hodiny) * 1e6) / 1e6;
        }
      }

      vysledek[zakazka.cislo] = {
        cislo: zakazka.cislo,
        pripravarId: pripravar.id,
        faze: plan.faze,
        predpokladaneDokonceni: plan.predpokladaneDokonceni,
        stav: urciStav(plan.predpokladaneDokonceni, zakazka.terminDokonceni, nastaveni.rezervaDny),
        ...nejpozdejsiStart(zakazka, nastaveni),
      };
    }

    konecFronty[pripravar.id] = kurzor;
    vytizeni[pripravar.id] = tydny;
  }

  for (const zakazka of zakazky) {
    if (!vysledek[zakazka.cislo]) {
      vysledek[zakazka.cislo] = {
        cislo: zakazka.cislo,
        faze: {},
        stav: 'neprirazeno',
        ...nejpozdejsiStart(zakazka, nastaveni),
      };
    }
  }

  return { zakazky: vysledek, konecFronty, vytizeni };
}
