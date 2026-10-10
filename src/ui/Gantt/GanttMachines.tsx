// Gantt strojů: řádky stroj 1, stroj 2, stroj 3, kompletace / ohýbání. Pruhy fází všech zakázek;
// překrývající se intervaly se rozloží do drah a dostanou zvýrazněný okraj (plán kolize neřeší, jen je ukazuje).

import { useMemo } from 'react';
import { STROJE, hodinyFaze, nazevFaze } from '../../domain/types';
import type { FazeId } from '../../domain/types';
import { usePlanStore } from '../../store/planStore';
import { formatHodiny } from '../format';
import { BARVA_STAVU, GanttHlavicka, GanttPodklad, GanttPopisky, Legenda, PopisekRadku, Pruh, SIRKA_POPISKU, VYSKA_HLAVICKY, ZoomOvladani, useGanttZoom } from './GanttAxis';
import type { RadekPopisku } from './GanttAxis';
import { tooltipZakazky } from './GanttPreparers';
import type { GanttProps } from './GanttPreparers';
import { rozlozDoDrah, spocitejOsu, xCasu } from './lanes';
import type { Usek } from './lanes';

const ODSAZENI = 6;
const VYSKA_PRUHU = 18;
const ROZTEC_DRAH = 22;
const MIN_VYSKA_RADKU = ODSAZENI * 2 + VYSKA_PRUHU;

const RADKY: FazeId[] = [...STROJE, 'kompletace'];

interface UsekStroje extends Usek {
  cislo: string;
}

export function GanttMachines({ rozvrh, dnes, zoom, setZoom, pocetDnu }: GanttProps) {
  const zakazky = usePlanStore((s) => s.zakazky);
  const pripravari = usePlanStore((s) => s.pripravari);
  const prirazeni = usePlanStore((s) => s.prirazeni);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const priblizeni = useGanttZoom(zoom, setZoom, pocetDnu);
  const osa = useMemo(
    () => spocitejOsu({ zakazky, pripravari, prirazeni, nastaveni }, rozvrh, dnes, priblizeni.sirkaDne),
    [zakazky, pripravari, prirazeni, nastaveni, rozvrh, dnes, priblizeni.sirkaDne],
  );
  const podleCisla = new Map(zakazky.map((z) => [z.cislo, z]));
  const x0 = SIRKA_POPISKU;
  // Hodiny v hlavičce dávají smysl, jen když mají všechny řádky stejné hodiny/den.
  const hodDenStroju = Object.values(nastaveni.hodDenStroj);
  const hodDenSpolecne = hodDenStroju.every((h) => h === hodDenStroju[0]) ? hodDenStroju[0] : undefined;

  const radky = RADKY.map((faze) => {
    const useky: UsekStroje[] = [];
    let hodiny = 0;
    for (const r of Object.values(rozvrh.zakazky)) {
      const f = r.faze[faze];
      if (!f) continue;
      hodiny += f.hodiny;
      useky.push({ id: `${faze}-${r.cislo}`, cislo: r.cislo, od: xCasu(osa, f.start), do: xCasu(osa, f.konec) });
    }
    const drahy = rozlozDoDrah(useky);
    const vyska = Math.max(MIN_VYSKA_RADKU, ODSAZENI * 2 + drahy.pocetDrah * ROZTEC_DRAH - (ROZTEC_DRAH - VYSKA_PRUHU));
    const prekryvy = drahy.useky.filter((u) => u.prekryv).length;
    const nazev = faze === 'kompletace' ? 'Kompletace / ohýbání' : nazevFaze(nastaveni, faze);
    return { faze, nazev, drahy, vyska, hodiny, prekryvy };
  });

  const vyskaRadku = radky.reduce((s, r) => s + r.vyska, 0);
  const vyska = VYSKA_HLAVICKY + vyskaRadku;
  const sirka = x0 + osa.sirka;

  let y = VYSKA_HLAVICKY;
  const popisky: RadekPopisku[] = [];
  const vykreslene = radky.map((radek) => {
    const yRadku = y;
    y += radek.vyska;
    const vedlejsi = `${formatHodiny(radek.hodiny)} h · ${formatHodiny(nastaveni.hodDenStroj[radek.faze as keyof typeof nastaveni.hodDenStroj])} h/den${radek.prekryvy ? ` · ${radek.prekryvy} v překryvu` : ''}`;
    popisky.push({ y: yRadku, vyska: radek.vyska, nazev: radek.nazev, vedlejsi });
    return (
      <g key={radek.faze}>
        <line x1={x0} y1={yRadku + radek.vyska} x2={sirka} y2={yRadku + radek.vyska} stroke="#e5e7eb" />
        <PopisekRadku y={yRadku} vyska={radek.vyska} vedlejsi={vedlejsi}>
          {radek.nazev}
        </PopisekRadku>
        {radek.drahy.useky.map(({ usek, draha, prekryv }) => {
          const r = rozvrh.zakazky[usek.cislo];
          const z = podleCisla.get(usek.cislo)!;
          const pripravar = pripravari.find((p) => p.id === r.pripravarId);
          return (
            <Pruh
              key={usek.id}
              id={`st-${usek.id}`}
              x={x0 + usek.od}
              y={yRadku + ODSAZENI + draha * ROZTEC_DRAH}
              sirka={usek.do - usek.od}
              vyska={VYSKA_PRUHU}
              barva={BARVA_STAVU[r.stav]}
              popisek={`${z.cislo} (${formatHodiny(hodinyFaze(z, radek.faze))} h)`}
              zvyraznitOkraj={prekryv}
              tooltip={`${tooltipZakazky(z, r, nastaveni, pripravar)}${prekryv ? '\nPřekrývá se s jinou zakázkou na tomto stroji.' : ''}`}
            />
          );
        })}
      </g>
    );
  });

  return (
    <section className="gantt">
      <div className="gantt-ovladani">
        <ZoomOvladani zoom={priblizeni} pocetDnu={pocetDnu} />
        <span className="napoveda">Stroje běží paralelně po TPV; plán kolize neřeší, překryvy jsou jen zvýrazněné.</span>
        <Legenda
          polozky={[
            { barva: BARVA_STAVU.ok, text: 'OK' },
            { barva: BARVA_STAVU.ohrozeno, text: 'ohroženo' },
            { barva: BARVA_STAVU.pozde, text: 'pozdě' },
            { barva: BARVA_STAVU.ok, text: 'překryv na stroji', okraj: true },
          ]}
        />
      </div>
      <div className="gantt-posuv" ref={priblizeni.ref}>
        <GanttPopisky vyska={vyska} radky={popisky} />
        <svg width={sirka} height={vyska} viewBox={`0 0 ${sirka} ${vyska}`} className="gantt-svg" role="img" aria-label="Gantt strojů">
          <GanttPodklad osa={osa} vyska={vyskaRadku} dnes={dnes} zacatekPlanu={nastaveni.zacatekPlanu} hodDen={hodDenSpolecne} />
          <GanttHlavicka osa={osa} hodDen={hodDenSpolecne} posun={priblizeni.posun} />
          <rect x={0} y={0} width={SIRKA_POPISKU} height={VYSKA_HLAVICKY} fill="#f8fafc" stroke="#e5e7eb" />
          {vykreslene}
        </svg>
      </div>
    </section>
  );
}
