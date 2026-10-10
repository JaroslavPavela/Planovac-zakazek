// Zustand store s persist do localStorage (klíč tpv-planovac-v1) a historií zpět/znovu pro přiřazení.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { presunZakazku } from '../domain/prirazeni';
import { navrhniRozdeleni, seradFrontuPodleTerminu } from '../domain/suggest';
import { vychoziNastaveni, vychoziPripravari } from '../domain/types';
import type { Nastaveni, Pripravar, Prirazeni, StavAplikace, StrojId, Zakazka } from '../domain/types';

export const KLIC_ULOZISTE = 'tpv-planovac-v1';
/** Verze uloženého stavu: 1 = stroje přejmenované z frezka1/frezka2/vysekavacka na stroj1–3; 2 = editovatelné názvy strojů. */
export const VERZE_ULOZISTE = 2;
const LIMIT_HISTORIE = 100;

const STARE_STROJE: Record<string, StrojId> = { frezka1: 'stroj1', frezka2: 'stroj2', vysekavacka: 'stroj3' };

/** Převede stav uložený starší verzí aplikace na aktuální tvar (chybějící části doplní výchozími). */
export function migrujUlozenyStav(ulozeny: unknown, verze: number): StavAplikace {
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
  };
}

export function dnesIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface PlanStore extends StavAplikace {
  minulost: Prirazeni[][];
  budoucnost: Prirazeni[][];

  nahradData: (zakazky: Zakazka[], prirazeni: Prirazeni[]) => void;
  nastavPrirazeni: (prirazeni: Prirazeni[]) => void;
  presunZakazku: (cislo: string, pripravarId: string | null, index?: number) => void;
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

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => {
      /** Nastaví nová přiřazení a zapíše předchozí do historie. */
      const sHistorii = (nova: Prirazeni[]) => {
        const { prirazeni, minulost } = get();
        if (stejnaPrirazeni(prirazeni, nova)) return;
        set({
          prirazeni: nova,
          minulost: [...minulost.slice(-(LIMIT_HISTORIE - 1)), prirazeni],
          budoucnost: [],
        });
      };

      return {
        zakazky: [],
        pripravari: vychoziPripravari(),
        prirazeni: [],
        nastaveni: vychoziNastaveni(dnesIso()),
        minulost: [],
        budoucnost: [],

        nahradData: (zakazky, prirazeni) => set({ zakazky, prirazeni, minulost: [], budoucnost: [] }),
        nastavPrirazeni: (prirazeni) => sHistorii(prirazeni),
        presunZakazku: (cislo, pripravarId, index) => sHistorii(presunZakazku(get().prirazeni, cislo, pripravarId, index)),
        navrhniRozdeleni: () => sHistorii(navrhniRozdeleni(stavAplikace(get()))),
        seradFrontu: (pripravarId) => sHistorii(seradFrontuPodleTerminu(stavAplikace(get()), pripravarId)),
        zpet: () => {
          const { minulost, budoucnost, prirazeni } = get();
          if (minulost.length === 0) return;
          set({ prirazeni: minulost[minulost.length - 1], minulost: minulost.slice(0, -1), budoucnost: [prirazeni, ...budoucnost] });
        },
        znovu: () => {
          const { minulost, budoucnost, prirazeni } = get();
          if (budoucnost.length === 0) return;
          set({ prirazeni: budoucnost[0], budoucnost: budoucnost.slice(1), minulost: [...minulost, prirazeni] });
        },
        upravNastaveni: (zmena) => set({ nastaveni: { ...get().nastaveni, ...zmena } }),
        nastavHodDenStroje: (stroj, hodiny) =>
          set({ nastaveni: { ...get().nastaveni, hodDenStroj: { ...get().nastaveni.hodDenStroj, [stroj]: hodiny } } }),
        prejmenujStroj: (stroj, nazev) =>
          set({ nastaveni: { ...get().nastaveni, nazvyStroju: { ...get().nastaveni.nazvyStroju, [stroj]: nazev } } }),
        prejmenujPripravare: (id, nazev) =>
          set({ pripravari: get().pripravari.map((p) => (p.id === id ? { ...p, nazev } : p)) }),
        vymazVse: () =>
          set({ zakazky: [], prirazeni: [], pripravari: vychoziPripravari(), nastaveni: vychoziNastaveni(dnesIso()), minulost: [], budoucnost: [] }),
      };
    },
    {
      name: KLIC_ULOZISTE,
      version: VERZE_ULOZISTE,
      partialize: (s) => ({ zakazky: s.zakazky, pripravari: s.pripravari, prirazeni: s.prirazeni, nastaveni: s.nastaveni }),
      migrate: (ulozeny, verze) => migrujUlozenyStav(ulozeny, verze) as unknown as PlanStore,
    },
  ),
);

export function stavAplikace(s: StavAplikace): StavAplikace {
  return { zakazky: s.zakazky, pripravari: s.pripravari, prirazeni: s.prirazeni, nastaveni: s.nastaveni };
}
