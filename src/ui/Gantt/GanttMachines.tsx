// Gantt strojů a Gantt kompletace (6.4): řádek = pracoviště (stroj 1–3, nebo kompletace / ohýbání), pruhy = fáze
// zakázek v pořadí fronty (5.7) — v řádku se nepřekrývají. Čekání ve frontě (připraveno → start) je přerušovaná čára.

import { useMemo } from 'react';
import { porovnej } from '../../domain/calendar';
import { nazevFaze } from '../../domain/types';
import type { NavazujiciFaze, Nastaveni } from '../../domain/types';
import { usePlanStore } from '../../store/planStore';
import { formatHodiny, formatPracovniCas } from '../format';
import { BARVA_STAVU, GanttHlavicka, GanttPodklad, GanttPopisky, Legenda, PopisekRadku, Pruh, SIRKA_POPISKU, VYSKA_HLAVICKY, ZoomOvladani, useGanttZoom } from './GanttAxis';
import type { RadekPopisku } from './GanttAxis';
import { tooltipZakazky } from './GanttPreparers';
import type { GanttProps } from './GanttPreparers';
import { spocitejOsu, xCasu } from './lanes';

const ODSAZENI = 8;
const VYSKA_PRUHU = 20;
const VYSKA_RADKU = ODSAZENI * 2 + VYSKA_PRUHU;
const BARVA_CEKANI = '#6b7280';

export function popisekPracoviste(nastaveni: Nastaveni, faze: NavazujiciFaze): string {
  return faze === 'kompletace' ? 'Kompletace / ohýbání' : nazevFaze(nastaveni, faze);
}

interface Props extends GanttProps {
  radky: readonly NavazujiciFaze[];
}

export function GanttMachines({ rozvrh, dnes, zoom, setZoom, pocetDnu, radky: fazeRadku }: Props) {
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
  const hodDenRadku = fazeRadku.map((f) => nastaveni.hodDenStroj[f]);
  const hodDenSpolecne = hodDenRadku.every((h) => h === hodDenRadku[0]) ? hodDenRadku[0] : undefined;
  const jeKompletace = fazeRadku.length === 1 && fazeRadku[0] === 'kompletace';

  const vyskaRadku = fazeRadku.length * VYSKA_RADKU;
  const vyska = VYSKA_HLAVICKY + vyskaRadku;
  const sirka = x0 + osa.sirka;

  const popisky: RadekPopisku[] = [];
  const vykreslene = fazeRadku.map((faze, iRadku) => {
    const yRadku = VYSKA_HLAVICKY + iRadku * VYSKA_RADKU;
    const yPruhu = yRadku + ODSAZENI;
    const hodDen = nastaveni.hodDenStroj[faze];
    const fronta = rozvrh.frontyFaze[faze];
    const hodiny = fronta.reduce((s, c) => s + (rozvrh.zakazky[c]?.faze[faze]?.hodiny ?? 0), 0);
    const nazev = popisekPracoviste(nastaveni, faze);
    const vedlejsi = `${fronta.length} zak. · ${formatHodiny(hodiny)} h · ${formatHodiny(hodDen)} h/den`;
    popisky.push({ y: yRadku, vyska: VYSKA_RADKU, nazev, vedlejsi });
    const yStred = yPruhu + VYSKA_PRUHU / 2;
    const polozky = fronta.flatMap((cislo, poradi) => {
      const r = rozvrh.zakazky[cislo];
      const f = r?.faze[faze];
      const z = podleCisla.get(cislo);
      if (!f || !z) return [];
      const xStart = x0 + xCasu(osa, f.start);
      const xPripraveno = f.pripraveno ? x0 + xCasu(osa, f.pripraveno) : xStart;
      const ceka = f.pripraveno !== undefined && porovnej(f.pripraveno, f.start) < 0 && xStart - xPripraveno >= 1;
      const cekani = ceka ? `připraveno ${formatPracovniCas(f.pripraveno, hodDen)}, start ${formatPracovniCas(f.start, hodDen)}` : '';
      return [{ cislo, poradi, r, f, z, xStart, xPripraveno, cekani }];
    });
    return (
      <g key={faze}>
        <line x1={x0} y1={yRadku + VYSKA_RADKU} x2={sirka} y2={yRadku + VYSKA_RADKU} stroke="#e5e7eb" />
        <PopisekRadku y={yRadku} vyska={VYSKA_RADKU} vedlejsi={vedlejsi}>
          {nazev}
        </PopisekRadku>
        {/* Nejdřív čáry čekání, pak pruhy — čekání pod pruhem předchozí zakázky je zakryté, vidět je jen v mezerách. */}
        {polozky.map(({ cislo, z, cekani, xPripraveno, xStart }) =>
          cekani ? (
            <g key={`cekani-${cislo}`} className="gantt-cekani">
              <line x1={xPripraveno} y1={yStred} x2={xStart} y2={yStred} stroke={BARVA_CEKANI} strokeWidth={1.5} strokeDasharray="4 3" />
              <line x1={xPripraveno} y1={yStred - 4} x2={xPripraveno} y2={yStred + 4} stroke={BARVA_CEKANI} strokeWidth={1.5} />
              <title>{`${z.cislo} — čeká ve frontě: ${cekani}`}</title>
            </g>
          ) : null,
        )}
        {polozky.map(({ cislo, z, r, f, poradi, cekani, xStart }) => (
          <Pruh
            key={cislo}
            id={`st-${faze}-${cislo}`}
            x={xStart}
            y={yPruhu}
            sirka={x0 + xCasu(osa, f.konec) - xStart}
            vyska={VYSKA_PRUHU}
            barva={BARVA_STAVU[r.stav]}
            popisek={`${z.cislo} (${formatHodiny(f.hodiny)} h)`}
            tooltip={`${poradi + 1}. ve frontě ${nazev}\n${tooltipZakazky(z, r, nastaveni, pripravari.find((p) => p.id === r.pripravarId))}${cekani ? `\nČeká ve frontě: ${cekani}` : ''}`}
          />
        ))}
      </g>
    );
  });

  return (
    <section className="gantt">
      <div className="gantt-ovladani">
        <ZoomOvladani zoom={priblizeni} pocetDnu={pocetDnu} />
        <span className="napoveda">
          {jeKompletace ? 'Kompletace zpracovává zakázky' : 'Každý stroj zpracovává zakázky'} postupně podle fronty; pořadí změníte přetažením v tabuli pod diagramem.
        </span>
        <Legenda
          polozky={[
            { barva: BARVA_STAVU.ok, text: 'OK' },
            { barva: BARVA_STAVU.ohrozeno, text: 'ohroženo' },
            { barva: BARVA_STAVU.pozde, text: 'pozdě' },
          ]}
          cekani
        />
      </div>
      <div className="gantt-posuv" ref={priblizeni.ref}>
        <GanttPopisky vyska={vyska} radky={popisky} />
        <svg width={sirka} height={vyska} viewBox={`0 0 ${sirka} ${vyska}`} className="gantt-svg" role="img" aria-label={jeKompletace ? 'Gantt kompletace' : 'Gantt strojů'}>
          <GanttPodklad osa={osa} vyska={vyskaRadku} dnes={dnes} zacatekPlanu={nastaveni.zacatekPlanu} hodDen={hodDenSpolecne} />
          <GanttHlavicka osa={osa} hodDen={hodDenSpolecne} posun={priblizeni.posun} />
          <rect x={0} y={0} width={SIRKA_POPISKU} height={VYSKA_HLAVICKY} fill="#f8fafc" stroke="#e5e7eb" />
          {vykreslene}
        </svg>
      </div>
    </section>
  );
}
