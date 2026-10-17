// Datový model podle sekce 3 specifikace.

export type StrojId = 'stroj1' | 'stroj2' | 'stroj3';
export type FazeId = 'tpv' | StrojId | 'kompletace';

export const STROJE: readonly StrojId[] = ['stroj1', 'stroj2', 'stroj3'];
export const FAZE: readonly FazeId[] = ['tpv', ...STROJE, 'kompletace'];

/** Fáze plánované ve vlastní frontě (5.7): stroje a kompletace. */
export type NavazujiciFaze = StrojId | 'kompletace';
export const NAVAZUJICI_FAZE: readonly NavazujiciFaze[] = [...STROJE, 'kompletace'];

/** Pořadí ve frontách strojů a kompletace: fáze → čísla zakázek v pořadí fronty. */
export type PoradiFaze = Record<NavazujiciFaze, string[]>;

export function prazdnePoradiFaze(): PoradiFaze {
  return { stroj1: [], stroj2: [], stroj3: [], kompletace: [] };
}

export interface Zakazka {
  cislo: string;
  nazev: string;
  firma: string;
  tpvHod: number;
  stroj1Hod: number;
  stroj2Hod: number;
  stroj3Hod: number;
  kompletaceHod: number;
  terminZadani: string; // ISO 'YYYY-MM-DD'
  terminDokonceni: string; // ISO 'YYYY-MM-DD'
}

export interface Pripravar {
  id: string; // 'p1' … 'p6'
  nazev: string; // výchozí 'Přípravář 1' … 'Přípravář 6'
}

export interface Prirazeni {
  zakazkaCislo: string;
  pripravarId: string;
  poradi: number; // pořadí ve frontě (0, 1, 2 …)
}

export interface Nastaveni {
  zacatekPlanu: string; // ISO date; výchozí dnes
  rezervaDny: number; // pracovní dny; výchozí 1
  hodDenPripravar: number; // výchozí 8
  hodDenStroj: Record<StrojId | 'kompletace', number>; // výchozí 8 pro každý
  nazvyStroju: Record<StrojId, string>; // zobrazované názvy strojů; výchozí 'Stroj 1' … 'Stroj 3' (hlavičky xlsx se nemění)
}

/** Okamžik v pracovním kalendáři: pracovní den + zlomek dne 0–1 (nezávislý na hodinách/den zdroje). */
export interface PracovniCas {
  den: string;
  zlomek: number;
}

export interface FazeRozvrh {
  start: PracovniCas;
  konec: PracovniCas;
  hodiny: number;
  pripraveno?: PracovniCas; // jen stroje a kompletace: konec předchozí fáze; start > pripraveno = čekání ve frontě
}

export type Stav = 'ok' | 'ohrozeno' | 'pozde' | 'neprirazeno';

export interface RozvrhZakazky {
  cislo: string;
  pripravarId?: string;
  faze: Partial<Record<FazeId, FazeRozvrh>>; // jen fáze s hodinami > 0
  predpokladaneDokonceni?: PracovniCas;
  stav: Stav;
  nejpozdejsiStartTpv: string; // ISO date
  nestihnutelne: boolean; // nejpozdější start < začátek plánu (nebo < termín zadání)
}

export interface Rozvrh {
  zakazky: Record<string, RozvrhZakazky>;
  konecFronty: Record<string, PracovniCas>; // per přípravář
  vytizeni: Record<string, Record<string, number>>; // přípravář → ISO týden ('2026-W42') → přidělené hodiny TPV
  frontyFaze: PoradiFaze; // výsledné pořadí front strojů a kompletace (ruční pořadí + nové zakázky podle připravenosti)
}

export interface StavAplikace {
  zakazky: Zakazka[];
  pripravari: Pripravar[];
  prirazeni: Prirazeni[];
  nastaveni: Nastaveni;
  poradiFaze?: Partial<PoradiFaze>; // ruční pořadí front strojů a kompletace; chybějící/prázdná fronta = automaticky podle připravenosti
}

/** Hodiny dané fáze zakázky. */
export function hodinyFaze(zakazka: Zakazka, faze: FazeId): number {
  switch (faze) {
    case 'tpv':
      return zakazka.tpvHod;
    case 'stroj1':
      return zakazka.stroj1Hod;
    case 'stroj2':
      return zakazka.stroj2Hod;
    case 'stroj3':
      return zakazka.stroj3Hod;
    case 'kompletace':
      return zakazka.kompletaceHod;
  }
}

export const POCET_PRIPRAVARU = 6;

export function vychoziPripravari(): Pripravar[] {
  return Array.from({ length: POCET_PRIPRAVARU }, (_, i) => ({
    id: `p${i + 1}`,
    nazev: `Přípravář ${i + 1}`,
  }));
}

export const STROJ_POPISEK: Record<StrojId | 'kompletace', string> = {
  stroj1: 'Stroj 1',
  stroj2: 'Stroj 2',
  stroj3: 'Stroj 3',
  kompletace: 'Kompletace',
};

/** Výchozí (pevné) popisky strojů; uživatel je může v nastavení přejmenovat. */
export function vychoziNazvyStroju(): Record<StrojId, string> {
  return { stroj1: STROJ_POPISEK.stroj1, stroj2: STROJ_POPISEK.stroj2, stroj3: STROJ_POPISEK.stroj3 };
}

export function vychoziNastaveni(zacatekPlanu: string): Nastaveni {
  return {
    zacatekPlanu,
    rezervaDny: 1,
    hodDenPripravar: 8,
    hodDenStroj: { stroj1: 8, stroj2: 8, stroj3: 8, kompletace: 8 },
    nazvyStroju: vychoziNazvyStroju(),
  };
}

/** Zobrazovaný název fáze: stroje podle nastavení, TPV a kompletace pevně. */
export function nazevFaze(nastaveni: Nastaveni, faze: FazeId): string {
  if (faze === 'tpv') return 'TPV';
  if (faze === 'kompletace') return STROJ_POPISEK.kompletace;
  return nastaveni.nazvyStroju[faze]?.trim() || STROJ_POPISEK[faze];
}

export const STAV_POPISEK: Record<Stav, string> = {
  ok: 'OK',
  ohrozeno: 'Ohroženo',
  pozde: 'Pozdě',
  neprirazeno: 'Nepřiřazeno',
};

