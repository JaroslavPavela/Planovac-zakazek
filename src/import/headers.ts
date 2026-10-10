// Normalizace a mapování hlaviček xlsx podle sekce 2.2 specifikace.

export type KlicSloupce =
  | 'cislo zakazky'
  | 'nazev'
  | 'firma'
  | 'tpv'
  | 'stroj 1'
  | 'stroj 2'
  | 'stroj 3'
  | 'kompletace'
  | 'termin zadani'
  | 'termin dokonceni'
  | 'pripravar'
  | 'poradi';

export const POVINNE_SLOUPCE: readonly KlicSloupce[] = [
  'cislo zakazky',
  'nazev',
  'firma',
  'tpv',
  'stroj 1',
  'stroj 2',
  'stroj 3',
  'kompletace',
  'termin zadani',
  'termin dokonceni',
];

export const VOLITELNE_SLOUPCE: readonly KlicSloupce[] = ['pripravar', 'poradi'];

/** Názvy hlaviček pro export a vzor (klíč → text s diakritikou). */
export const NAZVY_SLOUPCU: Record<KlicSloupce, string> = {
  'cislo zakazky': 'Číslo zakázky',
  nazev: 'Název',
  firma: 'Firma',
  tpv: 'TPV [h]',
  'stroj 1': 'Stroj 1 [h]',
  'stroj 2': 'Stroj 2 [h]',
  'stroj 3': 'Stroj 3 [h]',
  kompletace: 'Kompletace [h]',
  'termin zadani': 'Termín zadání',
  'termin dokonceni': 'Termín dokončení',
  pripravar: 'Přípravář',
  poradi: 'Pořadí',
};

export function odstranDiakritiku(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Malá písmena, bez diakritiky, bez `[h]`, sloučené mezery, oříznuto. */
export function normalizujHlavicku(text: unknown): string {
  return odstranDiakritiku(String(text ?? ''))
    .toLowerCase()
    .replace(/\[\s*h\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type MapaSloupcu = Partial<Record<KlicSloupce, number>>;

export interface VysledekMapovani {
  mapa: MapaSloupcu;
  chybejici: KlicSloupce[];
}

const VSECHNY_KLICE = new Set<string>([...POVINNE_SLOUPCE, ...VOLITELNE_SLOUPCE]);

/** Starší názvy hlaviček (před přejmenováním strojů na Stroj 1–3), aby šly načíst dřívější soubory. */
export const ALIASY_SLOUPCU: Record<string, KlicSloupce> = {
  'frezka 1': 'stroj 1',
  'frezka 2': 'stroj 2',
  vysekavacka: 'stroj 3',
};

/** Namapuje hlavičky (libovolné pořadí) na indexy sloupců; při duplicitě platí první výskyt. */
export function namapujSloupce(hlavicky: unknown[]): VysledekMapovani {
  const mapa: MapaSloupcu = {};
  hlavicky.forEach((h, index) => {
    const normalizovany = normalizujHlavicku(h);
    const klic = ALIASY_SLOUPCU[normalizovany] ?? normalizovany;
    if (VSECHNY_KLICE.has(klic) && mapa[klic as KlicSloupce] === undefined) {
      mapa[klic as KlicSloupce] = index;
    }
  });
  const chybejici = POVINNE_SLOUPCE.filter((k) => mapa[k] === undefined);
  return { mapa, chybejici };
}
