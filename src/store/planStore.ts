// Zustand store s persist do localStorage (klíč tpv-planovac-v1) a historií zpět/znovu pro přiřazení a pořadí front.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { odeberZFrontFaze, presunVeFronteFaze, presunZakazku } from '../domain/prirazeni';
import { naplanuj } from '../domain/scheduler';
import { navrhniRozdeleni, seradFrontuPodleTerminu } from '../domain/suggest';
import { NAVAZUJICI_FAZE, prazdnePoradiFaze, vychoziNastaveni, vychoziPripravari } from '../domain/types';
import type { NavazujiciFaze, Nastaveni, PoradiFaze, Pripravar, Prirazeni, StavAplikace, StrojId, Zakazka } from '../domain/types';

export const KLIC_ULOZISTE = 'tpv-planovac-v1';
/**
 * Verze uloženého stavu: 1 = stroje přejmenované z frezka1/frezka2/vysekavacka na stroj1–3; 2 = editovatelné názvy strojů;
 * 3 = ruční pořadí front strojů a kompletace (`poradiFaze`).
 */
export const VERZE_ULOZISTE = 3;
const LIMIT_HISTORIE = 100;

const STARE_STROJE: Record<string, StrojId> = { frezka1: 'stroj1', frezka2: 'stroj2', vysekavacka: 'stroj3' };

/** Stav, který store drží a ukládá: `poradiFaze` je vždy úplné. */
export type UlozenyStav = StavAplikace & { poradiFaze: PoradiFaze };

/** Úplné ruční pořadí front; neplatné nebo chybějící fronty jsou prázdné (= automaticky podle připravenosti). */
function normalizujPoradiFaze(ulozene: unknown): PoradiFaze {
  const vysledek = prazdnePoradiFaze();
  const zdroj = (ulozene ?? {}) as Partial<Record<NavazujiciFaze, unknown>>;
  for (const faze of NAVAZUJICI_FAZE) {
    const fronta = zdroj[faze];
    if (Array.isArray(fronta)) vysledek[faze] = fronta.filter((c): c is string => typeof c === 'string');
  }
  return vysledek;
}

/** Převede stav uložený starší verzí aplikace na aktuální tvar (chybějící části doplní výchozími). */
export function migrujUlozenyStav(ulozeny: unknown, verze: number): UlozenyStav {
  const s = (ulozeny ?? {}) as Partial<Record<keyof StavAplikace, unknown>>;
  const vychozi = vychoziNastaveni(dnesIso());
  const zakazky = Array.isArray(s.zakazky) ? (s.zakazky as Record<string, unknown>[]) : [];
  const nastaveni = (s.nastaveni ?? {}) as Partial<Omit<Nastaveni, 'hodDenStroj' | 'nazvyStroju'>> & {
    hodDenStroj?: Record<string, number>;
    nazvyStroju?: Partial<Record<StrojId, string>>;
  };
  if (verze < 1) {
    for (const z of zakazky) {
      for (const [stary, novy] of Object.entries(STARE_STROJE)) {
        if (`${novy}Hod` in z) continue;
        z[`${novy}Hod`] = z[`${stary}Hod`] ?? 0;
        delete z[`${stary}Hod`];
      }
    }
    const hodDen = { ...(nastaveni.hodDenStroj ?? {}) };
    for (const [stary, novy] of Object.entries(STARE_STROJE)) {
      if (hodDen[novy] === undefined && hodDen[stary] !== undefined) hodDen[novy] = hodDen[stary];
      delete hodDen[stary];
    }
    nastaveni.hodDenStroj = hodDen;
  }
  return {
    zakazky: zakazky as unknown as Zakazka[],
    pripravari: Array.isArray(s.pripravari) ? (s.pripravari as Pripravar[]) : vychoziPripravari(),
    prirazeni: Array.isArray(s.prirazeni) ? (s.prirazeni as Prirazeni[]) : [],
    nastaveni: {
      ...vychozi,
      ...nastaveni,
      hodDenStroj: { ...vychozi.hodDenStroj, ...(nastaveni.hodDenStroj ?? {}) } as Nastaveni['hodDenStroj'],
      nazvyStroju: { ...vychozi.nazvyStroju, ...(nastaveni.nazvyStroju ?? {}) },
    },
    poradiFaze: normalizujPoradiFaze(s.poradiFaze),
  };
}

export function dnesIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Položka historie zpět/znovu: přiřazení a ruční pořadí front. */
export interface SnimekHistorie {
  prirazeni: Prirazeni[];
  poradiFaze: PoradiFaze;
}

export interface PlanStore extends UlozenyStav {
  minulost: SnimekHistorie[];
  budoucnost: SnimekHistorie[];

  nahradData: (zakazky: Zakazka[], prirazeni: Prirazeni[], poradiFaze?: PoradiFaze) => void;
  nastavPrirazeni: (prirazeni: Prirazeni[]) => void;
  presunZakazku: (cislo: string, pripravarId: string | null, index?: number) => void;
  /** Přesun ve frontě stroje / kompletace (index ve výsledné frontě po odebrání přesouvané zakázky). */
  presunVeFronte: (faze: NavazujiciFaze, cislo: string, index?: number) => void;
  /** Vyprázdní ruční pořadí fronty → fronta se řadí podle připravenosti. */
  seradFrontuFaze: (faze: NavazujiciFaze) => void;
  navrhniRozdeleni: () => void;
  seradFrontu: (pripravarId: string) => void;
  zpet: () => void;
  znovu: () => void;
  upravNastaveni: (zmena: Partial<Omit<Nastaveni, 'hodDenStroj'>>) => void;
  nastavHodDenStroje: (stroj: StrojId | 'kompletace', hodiny: number) => void;
  prejmenujPripravare: (id: string, nazev: string) => void;
  prejmenujStroj: (stroj: StrojId, nazev: string) => void;
  vymazVse: () => void;
}

function stejnaPrirazeni(a: Prirazeni[], b: Prirazeni[]): boolean {
  if (a.length !== b.length) return false;
  const klic = (p: Prirazeni) => `${p.pripravarId}/${p.poradi}/${p.zakazkaCislo}`;
  const sa = a.map(klic).sort();
  const sb = b.map(klic).sort();
  return sa.every((k, i) => k === sb[i]);
}

function stejnePoradiFaze(a: PoradiFaze, b: PoradiFaze): boolean {
  return NAVAZUJICI_FAZE.every((f) => a[f].length === b[f].length && a[f].every((c, i) => c === b[f][i]));
}

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => {
      const snimek = (): SnimekHistorie => ({ prirazeni: get().prirazeni, poradiFaze: get().poradiFaze });

      /** Nastaví nová přiřazení / pořadí front a zapíše předchozí stav do historie. */
      const sHistorii = (zmena: Partial<SnimekHistorie>) => {
        const puvodni = snimek();
        const novy = { ...puvodni, ...zmena };
        if (stejnaPrirazeni(puvodni.prirazeni, novy.prirazeni) && stejnePoradiFaze(puvodni.poradiFaze, novy.poradiFaze)) return;
        set({
          ...novy,
          minulost: [...get().minulost.slice(-(LIMIT_HISTORIE - 1)), puvodni],
          budoucnost: [],
        });
      };

      return {
        zakazky: [],
        pripravari: vychoziPripravari(),
        prirazeni: [],
        nastaveni: vychoziNastaveni(dnesIso()),
        poradiFaze: prazdnePoradiFaze(),
        minulost: [],
        budoucnost: [],

        nahradData: (zakazky, prirazeni, poradiFaze = prazdnePoradiFaze()) =>
          set({ zakazky, prirazeni, poradiFaze, minulost: [], budoucnost: [] }),
        nastavPrirazeni: (prirazeni) => sHistorii({ prirazeni }),
        presunZakazku: (cislo, pripravarId, index) =>
          sHistorii({
            prirazeni: presunZakazku(get().prirazeni, cislo, pripravarId, index),
            // Zakázka vrácená do zásobníku vypadne z ručního pořadí front; po novém přiřazení se zařadí podle připravenosti.
            ...(pripravarId === null ? { poradiFaze: odeberZFrontFaze(get().poradiFaze, cislo) } : {}),
          }),
        presunVeFronte: (faze, cislo, index) => {
          const fronta = naplanuj(stavAplikace(get())).frontyFaze[faze];
          if (!fronta.includes(cislo)) return;
          const nova = presunVeFronteFaze(fronta, cislo, index);
          if (nova.every((c, i) => c === fronta[i])) return;
          sHistorii({ poradiFaze: { ...get().poradiFaze, [faze]: nova } });
        },
        seradFrontuFaze: (faze) => sHistorii({ poradiFaze: { ...get().poradiFaze, [faze]: [] } }),
        navrhniRozdeleni: () => sHistorii({ prirazeni: navrhniRozdeleni(stavAplikace(get())) }),
        seradFrontu: (pripravarId) => sHistorii({ prirazeni: seradFrontuPodleTerminu(stavAplikace(get()), pripravarId) }),
        zpet: () => {
          const { minulost, budoucnost } = get();
          if (minulost.length === 0) return;
          set({ ...minulost[minulost.length - 1], minulost: minulost.slice(0, -1), budoucnost: [snimek(), ...budoucnost] });
        },
        znovu: () => {
          const { minulost, budoucnost } = get();
          if (budoucnost.length === 0) return;
          set({ ...budoucnost[0], budoucnost: budoucnost.slice(1), minulost: [...minulost, snimek()] });
        },
        upravNastaveni: (zmena) => set({ nastaveni: { ...get().nastaveni, ...zmena } }),
        nastavHodDenStroje: (stroj, hodiny) =>
          set({ nastaveni: { ...get().nastaveni, hodDenStroj: { ...get().nastaveni.hodDenStroj, [stroj]: hodiny } } }),
        prejmenujStroj: (stroj, nazev) =>
          set({ nastaveni: { ...get().nastaveni, nazvyStroju: { ...get().nastaveni.nazvyStroju, [stroj]: nazev } } }),
        prejmenujPripravare: (id, nazev) =>
          set({ pripravari: get().pripravari.map((p) => (p.id === id ? { ...p, nazev } : p)) }),
        vymazVse: () =>
          set({
            zakazky: [],
            prirazeni: [],
            poradiFaze: prazdnePoradiFaze(),
            pripravari: vychoziPripravari(),
            nastaveni: vychoziNastaveni(dnesIso()),
            minulost: [],
            budoucnost: [],
          }),
      };
    },
    {
      name: KLIC_ULOZISTE,
      version: VERZE_ULOZISTE,
      partialize: (s): UlozenyStav => ({
        zakazky: s.zakazky,
        pripravari: s.pripravari,
        prirazeni: s.prirazeni,
        nastaveni: s.nastaveni,
        poradiFaze: s.poradiFaze,
      }),
      migrate: (ulozeny, verze) => migrujUlozenyStav(ulozeny, verze) as unknown as PlanStore,
    },
  ),
);

export function stavAplikace(s: StavAplikace): StavAplikace {
  return { zakazky: s.zakazky, pripravari: s.pripravari, prirazeni: s.prirazeni, nastaveni: s.nastaveni, poradiFaze: s.poradiFaze };
}
