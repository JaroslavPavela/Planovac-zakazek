// Gantt přípravářů: řádek = přípravář, pruhy = fáze TPV jeho zakázek, kosočtverec = termín dokončení.
// Volitelně navazující fáze (stroje, kompletace) ve stejném řádku světlejším odstínem v dalších drahách.

import { useMemo, useState } from 'react';
import { max as maxCas } from '../../domain/calendar';
import { FAZE, STAV_POPISEK, STROJE, hodinyFaze, nazevFaze } from '../../domain/types';
import type { FazeId, Nastaveni, Pripravar, Rozvrh, RozvrhZakazky, Zakazka } from '../../domain/types';
import { usePlanStore } from '../../store/planStore';
import { formatDatum, formatHodiny, formatPracovniCas } from '../format';
import { BARVA_STAVU, GanttHlavicka, GanttPodklad, GanttPopisky, Legenda, PopisekRadku, Pruh, SIRKA_POPISKU, Termin, VYSKA_HLAVICKY, ZoomOvladani, useGanttZoom } from './GanttAxis';
import type { RadekPopisku } from './GanttAxis';
import { rozlozDoDrah, spocitejOsu, xCasu, xDne } from './lanes';
import type { Usek } from './lanes';

const ODSAZENI = 6;
const VYSKA_TPV = 20;
const VYSKA_NAVAZUJICI = 10;
const ROZTEC_NAVAZUJICI = 14;

export function hodDenFaze(nastaveni: Nastaveni, faze: FazeId): number {
  return faze === 'tpv' ? nastaveni.hodDenPripravar : nastaveni.hodDenStroj[faze];
}

/** Víceřádkový text tooltipu se všemi fázemi zakázky. */
export function tooltipZakazky(zakazka: Zakazka, r: RozvrhZakazky, nastaveni: Nastaveni, pripravar?: Pripravar): string {
  const radky = [`${zakazka.cislo} — ${zakazka.nazev}`, zakazka.firma];
  if (pripravar) radky.push(`Přípravář: ${pripravar.nazev}`);
  for (const f of FAZE) {
    const faze = r.faze[f];
    if (!faze) continue;
    const hodDen = hodDenFaze(nastaveni, f);
    radky.push(`${nazevFaze(nastaveni, f)} ${formatHodiny(hodinyFaze(zakazka, f))} h: ${formatPracovniCas(faze.start, hodDen)} → ${formatPracovniCas(faze.konec, hodDen)}`);
  }
  radky.push(`Předpokládané dokončení: ${formatDatum(r.predpokladaneDokonceni?.den)}`);
  radky.push(`Termín dokončení: ${formatDatum(zakazka.terminDokonceni)}`);
  radky.push(`Stav: ${STAV_POPISEK[r.stav]}`);
  return radky.join('\n');
}

interface NavazujiciUsek extends Usek {
  cislo: string;
  druh: 'stroje' | 'kompletace';
}

export interface GanttProps {
  rozvrh: Rozvrh;
  dnes: string;
  zoom: number | null; // šířka dne v px, null = přehled
  setZoom: (z: number | null) => void;
  pocetDnu: number; // délka horizontu (pro rozsah přiblížení)
}

export function GanttPreparers({ rozvrh, dnes, zoom, setZoom, pocetDnu }: GanttProps) {
  const zakazky = usePlanStore((s) => s.zakazky);
  const pripravari = usePlanStore((s) => s.pripravari);
  const prirazeni = usePlanStore((s) => s.prirazeni);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const [navazujici, setNavazujici] = useState(false);
  const priblizeni = useGanttZoom(zoom, setZoom, pocetDnu);
  const osa = useMemo(
    () => spocitejOsu({ zakazky, pripravari, prirazeni, nastaveni }, rozvrh, dnes, priblizeni.sirkaDne),
    [zakazky, pripravari, prirazeni, nastaveni, rozvrh, dnes, priblizeni.sirkaDne],
  );

  const podleCisla = new Map(zakazky.map((z) => [z.cislo, z]));
  const x0 = SIRKA_POPISKU;

  // Řádky: pro každého přípraváře jeho zakázky, dráhy navazujících fází a výška řádku.
  const radky = pripravari.map((p) => {
    const polozky = Object.values(rozvrh.zakazky)
      .filter((r) => r.pripravarId === p.id)
      .map((r) => ({ r, z: podleCisla.get(r.cislo)! }))
      .filter((x) => x.z);

    const useky: NavazujiciUsek[] = [];
    if (navazujici) {
      for (const { r } of polozky) {
        const stroje = STROJE.map((s) => r.faze[s]).filter((f) => f !== undefined);
        if (stroje.length > 0) {
          const start = stroje[0].start;
          const konec = stroje.map((f) => f.konec).reduce(maxCas);
          useky.push({ id: `${r.cislo}-stroje`, cislo: r.cislo, druh: 'stroje', od: xCasu(osa, start), do: xCasu(osa, konec) });
        }
        if (r.faze.kompletace) {
          useky.push({ id: `${r.cislo}-kompletace`, cislo: r.cislo, druh: 'kompletace', od: xCasu(osa, r.faze.kompletace.start), do: xCasu(osa, r.faze.kompletace.konec) });
        }
      }
    }
    const drahy = rozlozDoDrah(useky);
    const vyska = ODSAZENI + VYSKA_TPV + drahy.pocetDrah * ROZTEC_NAVAZUJICI + ODSAZENI;
    return { p, polozky, drahy, vyska };
  });

  const vyskaRadku = radky.reduce((s, r) => s + r.vyska, 0);
  const vyska = VYSKA_HLAVICKY + vyskaRadku;
  const sirka = x0 + osa.sirka;

  let y = VYSKA_HLAVICKY;
  const popisky: RadekPopisku[] = [];
  const vykresleneRadky = radky.map(({ p, polozky, drahy, vyska: v }) => {
    const yRadku = y;
    y += v;
    const yTpv = yRadku + ODSAZENI;
    const hodinyTpv = polozky.reduce((s, { z }) => s + z.tpvHod, 0);
    popisky.push({ y: yRadku, vyska: v, nazev: p.nazev, vedlejsi: `${polozky.length} zak. · TPV ${formatHodiny(hodinyTpv)} h` });
    return (
      <g key={p.id}>
        <line x1={x0} y1={yRadku + v} x2={sirka} y2={yRadku + v} stroke="#e5e7eb" />
        <PopisekRadku y={yRadku} vyska={v} vedlejsi={`${polozky.length} zak. · TPV ${formatHodiny(hodinyTpv)} h`}>
          {p.nazev}
        </PopisekRadku>
        {drahy.useky.map(({ usek, draha }) => {
          const r = rozvrh.zakazky[usek.cislo];
          const z = podleCisla.get(usek.cislo)!;
          return (
            <Pruh
              key={usek.id}
              id={`pp-${usek.id}`}
              x={x0 + usek.od}
              y={yTpv + VYSKA_TPV + 4 + draha * ROZTEC_NAVAZUJICI}
              sirka={usek.do - usek.od}
              vyska={VYSKA_NAVAZUJICI}
              barva={BARVA_STAVU[r.stav]}
              pruhledny
              popisek={`${z.cislo} ${usek.druh === 'stroje' ? 'stroje' : 'kompl.'}`}
              tooltip={tooltipZakazky(z, r, nastaveni, p)}
            />
          );
        })}
        {polozky.map(({ r, z }) => {
          const tpv = r.faze.tpv;
          const barva = BARVA_STAVU[r.stav];
          return (
            <g key={z.cislo}>
              {tpv && (
                <Pruh
                  id={`tpv-${z.cislo}`}
                  x={x0 + xCasu(osa, tpv.start)}
                  y={yTpv}
                  sirka={xCasu(osa, tpv.konec) - xCasu(osa, tpv.start)}
                  vyska={VYSKA_TPV}
                  barva={barva}
                  popisek={z.cislo}
                  tooltip={tooltipZakazky(z, r, nastaveni, p)}
                />
              )}
              <Termin
                x={x0 + xDne(osa, z.terminDokonceni) + osa.sirkaDne / 2}
                y={yTpv + VYSKA_TPV / 2}
                barva={barva}
                tooltip={`${z.cislo} — termín dokončení ${formatDatum(z.terminDokonceni)}\nPředpokládané dokončení ${formatDatum(r.predpokladaneDokonceni?.den)}`}
              />
            </g>
          );
        })}
      </g>
    );
  });

  return (
    <section className="gantt">
      <div className="gantt-ovladani">
        <ZoomOvladani zoom={priblizeni} pocetDnu={pocetDnu} />
        <label>
          <input type="checkbox" checked={navazujici} onChange={(e) => setNavazujici(e.target.checked)} /> Zobrazit navazující fáze (stroje, kompletace)
        </label>
        <Legenda
          polozky={[
            { barva: BARVA_STAVU.ok, text: 'TPV — OK' },
            { barva: BARVA_STAVU.ohrozeno, text: 'ohroženo' },
            { barva: BARVA_STAVU.pozde, text: 'pozdě' },
            { barva: BARVA_STAVU.ok, text: 'navazující fáze', pruhledny: true },
          ]}
        />
      </div>
      <div className="gantt-posuv" ref={priblizeni.ref}>
        <GanttPopisky vyska={vyska} radky={popisky} />
        <svg width={sirka} height={vyska} viewBox={`0 0 ${sirka} ${vyska}`} className="gantt-svg" role="img" aria-label="Gantt přípravářů">
          <GanttPodklad osa={osa} vyska={vyskaRadku} dnes={dnes} zacatekPlanu={nastaveni.zacatekPlanu} hodDen={nastaveni.hodDenPripravar} />
          <GanttHlavicka osa={osa} hodDen={nastaveni.hodDenPripravar} posun={priblizeni.posun} />
          <rect x={0} y={0} width={SIRKA_POPISKU} height={VYSKA_HLAVICKY} fill="#f8fafc" stroke="#e5e7eb" />
          {vykresleneRadky}
        </svg>
      </div>
    </section>
  );
}
