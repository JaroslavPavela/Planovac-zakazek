// Geometrie osy Ganttu (horizont, převod pracovního času na x) a rozložení překrývajících se úseků do drah.
// Čisté funkce bez Reactu — testovatelné.

import { denVTydnu, isoTyden, pridejDny, rozdilDnu } from '../../domain/calendar';
import type { PracovniCas, Rozvrh, StavAplikace } from '../../domain/types';

export const SIRKA_DNE = 28;
export const MIN_TYDNU = 5;
export const REZERVA_DNU_ZA_KONCEM = 3;

export interface UsekOsy {
  od: string; // první den úseku (ISO)
  pocetDnu: number;
}

export interface TydenOsy extends UsekOsy {
  tyden: string; // '2026-W42'
}

export interface MesicOsy extends UsekOsy {
  rok: number;
  mesic: number; // 1–12
}

export interface Osa {
  od: string; // pondělí týdne, do kterého spadá začátek plánu
  do: string; // neděle posledního zobrazeného týdne
  dny: string[]; // všechny kalendářní dny od–do
  sirkaDne: number;
  sirka: number; // dny × sirkaDne
  tydny: TydenOsy[];
  mesice: MesicOsy[];
}

/** Pondělí týdne, do kterého den spadá. */
export function pondeliPred(iso: string): string {
  return pridejDny(iso, 1 - denVTydnu(iso));
}

/**
 * Horizont: od pondělí týdne začátku plánu po max(konec poslední fáze, nejzazší termín, dnes) + 3 dny,
 * minimálně 5 týdnů; konec se dorovná na neděli, aby byly týdny celé.
 */
export function spocitejOsu(stav: StavAplikace, rozvrh: Rozvrh, dnes: string, sirkaDne = SIRKA_DNE): Osa {
  const od = pondeliPred(stav.nastaveni.zacatekPlanu);
  let nejzazsi = stav.nastaveni.zacatekPlanu > dnes ? stav.nastaveni.zacatekPlanu : dnes;
  for (const z of stav.zakazky) {
    if (z.terminDokonceni > nejzazsi) nejzazsi = z.terminDokonceni;
  }
  for (const r of Object.values(rozvrh.zakazky)) {
    for (const f of Object.values(r.faze)) {
      if (f && f.konec.den > nejzazsi) nejzazsi = f.konec.den;
    }
  }
  let konec = pridejDny(nejzazsi, REZERVA_DNU_ZA_KONCEM);
  const minKonec = pridejDny(od, MIN_TYDNU * 7 - 1);
  if (konec < minKonec) konec = minKonec;
  const doDne = pridejDny(konec, 7 - denVTydnu(konec)); // neděle

  const dny: string[] = [];
  for (let d = od; d <= doDne; d = pridejDny(d, 1)) dny.push(d);

  const tydny: TydenOsy[] = [];
  const mesice: MesicOsy[] = [];
  for (const d of dny) {
    const tyden = isoTyden(d);
    const posledniTyden = tydny[tydny.length - 1];
    if (posledniTyden && posledniTyden.tyden === tyden) posledniTyden.pocetDnu++;
    else tydny.push({ tyden, od: d, pocetDnu: 1 });

    const rok = Number(d.slice(0, 4));
    const mesic = Number(d.slice(5, 7));
    const posledniMesic = mesice[mesice.length - 1];
    if (posledniMesic && posledniMesic.rok === rok && posledniMesic.mesic === mesic) posledniMesic.pocetDnu++;
    else mesice.push({ rok, mesic, od: d, pocetDnu: 1 });
  }

  return { od, do: doDne, dny, sirkaDne, sirka: dny.length * sirkaDne, tydny, mesice };
}

/** Levý okraj dne na ose (px). Dny před začátkem osy dávají záporné hodnoty. */
export function xDne(osa: Osa, iso: string): number {
  return rozdilDnu(osa.od, iso) * osa.sirkaDne;
}

/** Poloha pracovního času na ose: den + zlomek dne. */
export function xCasu(osa: Osa, cas: PracovniCas): number {
  return (rozdilDnu(osa.od, cas.den) + cas.zlomek) * osa.sirkaDne;
}

// ---------- dráhy ----------

export interface Usek {
  id: string;
  od: number;
  do: number;
}

export interface UsekVDraze<T extends Usek> {
  usek: T;
  draha: number; // 0 = první dráha
  prekryv: boolean; // překrývá se s jiným úsekem v témže řádku
}

/**
 * Hladově rozloží úseky do drah: úsek jde do první dráhy, jejíž poslední úsek skončil nejpozději v jeho začátku.
 * Vrací úseky v pořadí podle začátku; `pocetDrah` je nejvyšší použitá dráha + 1 (0 pro prázdný vstup).
 */
export function rozlozDoDrah<T extends Usek>(useky: T[]): { useky: UsekVDraze<T>[]; pocetDrah: number } {
  const serazene = [...useky].sort((a, b) => a.od - b.od || a.do - b.do || a.id.localeCompare(b.id));
  const konceDrah: number[] = [];
  const vysledek: UsekVDraze<T>[] = [];
  for (const usek of serazene) {
    let draha = konceDrah.findIndex((konec) => konec <= usek.od);
    if (draha < 0) {
      draha = konceDrah.length;
      konceDrah.push(usek.do);
    } else {
      konceDrah[draha] = usek.do;
    }
    const prekryv = serazene.some((j) => j !== usek && j.od < usek.do && usek.od < j.do);
    vysledek.push({ usek, draha, prekryv });
  }
  return { useky: vysledek, pocetDrah: konceDrah.length };
}
