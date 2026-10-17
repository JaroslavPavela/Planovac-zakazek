// Společné části SVG Ganttů: hlavička osy (měsíc / ISO týden / den), podklad (víkendy, svátky, mřížka,
// čára dnes a začátek plánu), pruh fáze s tooltipem a legenda.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { jePracovniDen, jeSvatek } from '../../domain/calendar';
import type { Stav } from '../../domain/types';
import { formatCasDne, formatDatum } from '../format';
import { xDne } from './lanes';
import type { Osa } from './lanes';

export const SIRKA_POPISKU = 150; // levý sloupec s názvy řádků
export const VYSKA_MESICE = 18;
export const VYSKA_TYDNE = 16;
export const VYSKA_DNE = 24;
export const VYSKA_HLAVICKY = VYSKA_MESICE + VYSKA_TYDNE + VYSKA_DNE;

export const BARVA_STAVU: Record<Stav, string> = {
  ok: '#16a34a',
  ohrozeno: '#f59e0b',
  pozde: '#dc2626',
  neprirazeno: '#9ca3af',
};

/** Od této šířky dne se kreslí hodinové dílky (mřížka i popisky v hlavičce). */
export const SIRKA_DNE_PRO_HODINY = 96;

/** Hodiny směny (1 … hodDen − 1) s polohou v rámci dne (zlomek) — pro dílky v hlavičce a mřížce. */
function hodinoveDilky(hodDen: number): { zlomek: number; hodina: number }[] {
  const dilky: { zlomek: number; hodina: number }[] = [];
  for (let h = 1; h < hodDen; h++) dilky.push({ zlomek: h / hodDen, hodina: h });
  return dilky;
}

/**
 * Hlavička osy: řádek měsíců, ISO týdnů a dnů; při velkém přiblížení i hodiny směny
 * (`hodDen` = hodin/den zdroje, podle kterého se hodiny popisují). Kreslí se od x = SIRKA_POPISKU.
 */
export function GanttHlavicka({ osa, hodDen, posun = 0 }: { osa: Osa; hodDen?: number; posun?: number }) {
  const x0 = SIRKA_POPISKU;
  const sirkaDne = osa.sirkaDne;
  /** X popisku úseku: drží se u levého okraje viditelné části, ale nevyjede z úseku. */
  const xPopisku = (x: number, sirka: number, rezerva: number) => Math.min(Math.max(x, x0 + posun), x + sirka - rezerva) + 4;
  const ukazatHodiny = hodDen !== undefined && sirkaDne >= SIRKA_DNE_PRO_HODINY;
  const krokPopisku = hodDen ? (sirkaDne / hodDen >= 34 ? 1 : sirkaDne / hodDen >= 17 ? 2 : 4) : 1;
  return (
    <g className="gantt-hlavicka">
      <rect x={0} y={0} width={x0 + osa.sirka} height={VYSKA_HLAVICKY} fill="#f8fafc" />
      {osa.mesice.map((m) => {
        const x = x0 + xDne(osa, m.od);
        const sirka = m.pocetDnu * osa.sirkaDne;
        const popisek = format(parseISO(m.od), 'LLLL yyyy', { locale: cs });
        return (
          <g key={m.od}>
            <rect x={x} y={0} width={sirka} height={VYSKA_MESICE} fill="#e2e8f0" stroke="#fff" />
            {sirka > 60 && (
              <text x={xPopisku(x, sirka, 90)} y={VYSKA_MESICE - 5} fontSize={11} fontWeight={600} fill="#1f2937">
                {popisek}
              </text>
            )}
          </g>
        );
      })}
      {osa.tydny.map((t) => {
        const x = x0 + xDne(osa, t.od);
        const sirka = t.pocetDnu * osa.sirkaDne;
        return (
          <g key={t.tyden}>
            <rect x={x} y={VYSKA_MESICE} width={sirka} height={VYSKA_TYDNE} fill="#f1f5f9" stroke="#fff" />
            {sirka > 30 && (
              <text x={xPopisku(x, sirka, 30)} y={VYSKA_MESICE + VYSKA_TYDNE - 4} fontSize={10} fill="#475569">
                T{t.tyden.slice(-2)}
              </text>
            )}
          </g>
        );
      })}
      {osa.dny.map((d) => {
        const x = x0 + xDne(osa, d);
        const pracovni = jePracovniDen(d);
        const datum = parseISO(d);
        const yDne = VYSKA_MESICE + VYSKA_TYDNE;
        const popisekDne = ukazatHodiny
          ? format(datum, 'EEEEEE d. M.', { locale: cs })
          : sirkaDne >= 40
            ? `${format(datum, 'EEEEEE', { locale: cs })} ${datum.getDate()}`
            : String(datum.getDate());
        return (
          <g key={d}>
            <rect x={x} y={yDne} width={sirkaDne} height={VYSKA_DNE} fill={pracovni ? '#fff' : '#e9ecf1'} stroke="#e5e7eb" />
            {sirkaDne >= 16 && (
              <text
                x={ukazatHodiny ? xPopisku(x, sirkaDne, 70) : x + sirkaDne / 2}
                y={ukazatHodiny ? yDne + 10 : yDne + VYSKA_DNE / 2 + 4}
                fontSize={10}
                textAnchor={ukazatHodiny ? 'start' : 'middle'}
                fill={pracovni ? '#1f2937' : '#6b7280'}
              >
                {popisekDne}
              </text>
            )}
            {ukazatHodiny &&
              pracovni &&
              hodinoveDilky(hodDen).map((dilek) => (
                <g key={dilek.hodina}>
                  <line x1={x + dilek.zlomek * sirkaDne} y1={yDne + VYSKA_DNE - 4} x2={x + dilek.zlomek * sirkaDne} y2={yDne + VYSKA_DNE} stroke="#94a3b8" />
                  {dilek.hodina % krokPopisku === 0 && (
                    <text x={x + dilek.zlomek * sirkaDne} y={yDne + VYSKA_DNE - 6} fontSize={8} textAnchor="middle" fill="#6b7280">
                      {formatCasDne(dilek.zlomek, hodDen)}
                    </text>
                  )}
                </g>
              ))}
          </g>
        );
      })}
    </g>
  );
}

interface PodkladProps {
  osa: Osa;
  vyska: number; // výška oblasti pod hlavičkou
  dnes: string;
  zacatekPlanu: string;
  hodDen?: number; // při velkém přiblížení hodinová mřížka
}

/** Podklad pod řádky: víkendy a svátky, denní (a hodinová) mřížka, svislé čáry dnes a začátek plánu. */
export function GanttPodklad({ osa, vyska, dnes, zacatekPlanu, hodDen }: PodkladProps) {
  const x0 = SIRKA_POPISKU;
  const y0 = VYSKA_HLAVICKY;
  const xDnes = xDne(osa, dnes);
  const xPlan = xDne(osa, zacatekPlanu);
  const hodiny = hodDen !== undefined && osa.sirkaDne >= SIRKA_DNE_PRO_HODINY ? hodinoveDilky(hodDen) : [];
  return (
    <g className="gantt-podklad">
      <rect x={x0} y={y0} width={osa.sirka} height={vyska} fill="#fff" />
      {osa.dny.map((d) => {
        const x = x0 + xDne(osa, d);
        if (jePracovniDen(d))
          return (
            <g key={d}>
              <line x1={x} y1={y0} x2={x} y2={y0 + vyska} stroke="#e5e7eb" />
              {hodiny.map((h) => (
                <line key={h.hodina} x1={x + h.zlomek * osa.sirkaDne} y1={y0} x2={x + h.zlomek * osa.sirkaDne} y2={y0 + vyska} stroke="#f1f5f9" />
              ))}
            </g>
          );
        const svatek = jeSvatek(d);
        return (
          <rect key={d} x={x} y={y0} width={osa.sirkaDne} height={vyska} fill={svatek ? '#fde2e2' : '#eef0f4'}>
            {svatek && <title>Státní svátek {formatDatum(d)}</title>}
          </rect>
        );
      })}
      {osa.tydny.map((t) => {
        const x = x0 + xDne(osa, t.od);
        return <line key={t.tyden} x1={x} y1={y0} x2={x} y2={y0 + vyska} stroke="#cbd5e1" />;
      })}
      {xPlan >= 0 && xPlan <= osa.sirka && (
        <g>
          <line x1={x0 + xPlan} y1={y0 - VYSKA_DNE} x2={x0 + xPlan} y2={y0 + vyska} stroke="#2563eb" strokeWidth={1.5} />
          <title>Začátek plánu {formatDatum(zacatekPlanu)}</title>
        </g>
      )}
      {xDnes >= 0 && xDnes <= osa.sirka && (
        <g>
          <line x1={x0 + xDnes} y1={y0 - VYSKA_DNE} x2={x0 + xDnes} y2={y0 + vyska} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 3" />
          <title>Dnes {formatDatum(dnes)}</title>
        </g>
      )}
    </g>
  );
}

interface PruhProps {
  id: string;
  x: number;
  y: number;
  sirka: number;
  vyska: number;
  barva: string;
  popisek?: string;
  tooltip: string;
  pruhledny?: boolean;
}

/** Vodorovný pruh fáze s popiskem oříznutým na šířku pruhu a tooltipem. */
export function Pruh({ id, x, y, sirka, vyska, barva, popisek, tooltip, pruhledny }: PruhProps) {
  const s = Math.max(sirka, 2);
  const clipId = `clip-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  return (
    <g className="gantt-pruh">
      <clipPath id={clipId}>
        <rect x={x} y={y} width={s} height={vyska} />
      </clipPath>
      <rect
        x={x}
        y={y}
        width={s}
        height={vyska}
        rx={2}
        fill={barva}
        fillOpacity={pruhledny ? 0.35 : 1}
      />
      {popisek && s > 24 && (
        <text x={x + 4} y={y + vyska / 2 + 3.5} fontSize={10} fill={pruhledny ? '#1f2937' : '#fff'} clipPath={`url(#${clipId})`}>
          {popisek}
        </text>
      )}
      <title>{tooltip}</title>
    </g>
  );
}

/** Kosočtverec termínu dokončení. */
export function Termin({ x, y, barva, tooltip }: { x: number; y: number; barva: string; tooltip: string }) {
  const r = 6;
  return (
    <g>
      <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} fill="#fff" stroke={barva} strokeWidth={2} />
      <title>{tooltip}</title>
    </g>
  );
}

/** Popisek řádku v levém sloupci. */
export function PopisekRadku({ y, vyska, children, vedlejsi }: { y: number; vyska: number; children: ReactNode; vedlejsi?: string }) {
  return (
    <g>
      <rect x={0} y={y} width={SIRKA_POPISKU} height={vyska} fill="#f8fafc" stroke="#e5e7eb" />
      <text x={8} y={y + (vedlejsi ? vyska / 2 - 2 : vyska / 2 + 4)} fontSize={12} fontWeight={600} fill="#1f2937">
        {children}
      </text>
      {vedlejsi && (
        <text x={8} y={y + vyska / 2 + 11} fontSize={10} fill="#6b7280">
          {vedlejsi}
        </text>
      )}
    </g>
  );
}

export interface RadekPopisku {
  y: number;
  vyska: number;
  nazev: string;
  vedlejsi?: string;
}

/**
 * Levý sloupec s názvy řádků přilepený k levému okraji při vodorovném posunu. Hlavní SVG má stejné
 * popisky pod ním (kvůli tisku, kde se tento sloupec skryje a hlavní SVG se zmenší na šířku stránky).
 */
export function GanttPopisky({ vyska, radky }: { vyska: number; radky: RadekPopisku[] }) {
  return (
    <svg width={SIRKA_POPISKU} height={vyska} viewBox={`0 0 ${SIRKA_POPISKU} ${vyska}`} className="gantt-popisky" aria-hidden="true">
      <rect x={0} y={0} width={SIRKA_POPISKU} height={VYSKA_HLAVICKY} fill="#f8fafc" stroke="#e5e7eb" />
      {radky.map((r) => (
        <PopisekRadku key={r.y} y={r.y} vyska={r.vyska} vedlejsi={r.vedlejsi}>
          {r.nazev}
        </PopisekRadku>
      ))}
    </svg>
  );
}

export function Legenda({ polozky, cekani }: { polozky: { barva: string; text: string; pruhledny?: boolean }[]; cekani?: boolean }) {
  return (
    <div className="gantt-legenda">
      {polozky.map((p) => (
        <span key={p.text}>
          <i style={{ background: p.barva, opacity: p.pruhledny ? 0.35 : 1 }} />
          {p.text}
        </span>
      ))}
      {cekani && (
        <span>
          <i className="legenda-cekani" /> čekání ve frontě
        </span>
      )}
      <span>
        <i className="legenda-cara legenda-plan" /> začátek plánu
      </span>
      <span>
        <i className="legenda-cara legenda-dnes" /> dnes
      </span>
    </div>
  );
}

// ---------- přiblížení ----------

const KROK_PRIBLIZENI = 1.5;

export interface GanttZoom {
  ref: (el: HTMLDivElement | null) => void;
  posun: number; // aktuální vodorovný posun kontejneru (scrollLeft)
  sirkaDne: number;
  minSirka: number; // celý horizont na šířku kontejneru (přehled)
  maxSirka: number; // jeden den na celou šířku
  jePrehled: boolean;
  priblizit: (nova: number | null, kotvaObsah?: number, kotvaOkno?: number) => void;
}

/**
 * Přiblížení Ganttu. `zoom` = požadovaná šířka dne v px, `null` = přehled (celý horizont na šířku).
 * Rozsah: od přehledu po jeden den přes celou šířku. Při změně se zachová místo pod kotvou
 * (střed okna nebo kurzor), Ctrl + kolečko myši přibližuje kolem kurzoru.
 */
export function useGanttZoom(zoom: number | null, setZoom: (z: number | null) => void, pocetDnu: number): GanttZoom {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [sirkaKontejneru, setSirkaKontejneru] = useState(0);
  const [posun, setPosun] = useState(0);
  const [tisk, setTisk] = useState(false);
  const cekajiciScroll = useRef<number | null>(null);

  // Posun sledujeme kvůli popiskům hlavičky. Při tisku se graf vykreslí v přehledu bez posunu
  // (flushSync, aby byl překreslený dřív, než si prohlížeč stránku vyfotí).
  useEffect(() => {
    if (!el) return;
    let snimek = 0;
    const naPosun = () => {
      cancelAnimationFrame(snimek);
      snimek = requestAnimationFrame(() => setPosun(el.scrollLeft));
    };
    const predTiskem = () =>
      flushSync(() => {
        setTisk(true);
        setPosun(0);
      });
    const poTisku = () => {
      setTisk(false);
      setPosun(el.scrollLeft);
    };
    el.addEventListener('scroll', naPosun, { passive: true });
    window.addEventListener('beforeprint', predTiskem);
    window.addEventListener('afterprint', poTisku);
    return () => {
      cancelAnimationFrame(snimek);
      el.removeEventListener('scroll', naPosun);
      window.removeEventListener('beforeprint', predTiskem);
      window.removeEventListener('afterprint', poTisku);
    };
  }, [el]);

  useEffect(() => {
    if (!el) return;
    const zmer = () => setSirkaKontejneru(el.clientWidth);
    zmer();
    const pozorovatel = new ResizeObserver(zmer);
    pozorovatel.observe(el);
    return () => pozorovatel.disconnect();
  }, [el]);

  const dostupna = Math.max(200, (sirkaKontejneru || 1200) - SIRKA_POPISKU - 2);
  const minSirka = dostupna / Math.max(1, pocetDnu);
  const maxSirka = dostupna;
  const omez = useCallback((s: number) => Math.min(maxSirka, Math.max(minSirka, s)), [minSirka, maxSirka]);
  const sirkaDne = zoom === null || tisk ? minSirka : omez(zoom);
  const sirkaDneRef = useRef(sirkaDne);
  sirkaDneRef.current = sirkaDne;

  const priblizit = useCallback(
    (nova: number | null, kotvaObsah?: number, kotvaOkno?: number) => {
      const cil = nova === null ? minSirka : omez(nova);
      if (el) {
        const faktor = cil / sirkaDneRef.current;
        const okno = kotvaOkno ?? el.clientWidth / 2;
        const obsah = kotvaObsah ?? el.scrollLeft + okno - SIRKA_POPISKU;
        cekajiciScroll.current = obsah * faktor + SIRKA_POPISKU - okno;
      }
      setZoom(nova === null ? null : cil);
    },
    [el, minSirka, omez, setZoom],
  );

  useLayoutEffect(() => {
    if (el && cekajiciScroll.current !== null) {
      el.scrollLeft = cekajiciScroll.current;
      cekajiciScroll.current = null;
      setPosun(el.scrollLeft);
    }
  }, [el, sirkaDne]);

  useEffect(() => {
    if (!el) return;
    const naKolecko = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const okraj = el.getBoundingClientRect();
      const okno = e.clientX - okraj.left;
      const obsah = el.scrollLeft + okno - SIRKA_POPISKU;
      priblizit(sirkaDneRef.current * (e.deltaY < 0 ? 1.2 : 1 / 1.2), obsah, okno);
    };
    el.addEventListener('wheel', naKolecko, { passive: false });
    return () => el.removeEventListener('wheel', naKolecko);
  }, [el, priblizit]);

  return { ref: setEl, posun, sirkaDne, minSirka, maxSirka, jePrehled: sirkaDne <= minSirka + 0.01, priblizit };
}

/** Ovládání přiblížení: Přehled · − · posuvník · + · 1 den. */
export function ZoomOvladani({ zoom, pocetDnu }: { zoom: GanttZoom; pocetDnu: number }) {
  const { sirkaDne, minSirka, maxSirka, jePrehled, priblizit } = zoom;
  const log = (v: number) => Math.log(v);
  const dnuVZaberu = Math.max(1, Math.round(maxSirka / sirkaDne));
  const sklonovani = (n: number) => (n === 1 ? 'den' : n <= 4 ? 'dny' : 'dnů');
  const popisZaberu = jePrehled ? `celý plán (${pocetDnu} ${sklonovani(pocetDnu)})` : dnuVZaberu === 1 ? '1 den v záběru' : `~${dnuVZaberu} ${sklonovani(dnuVZaberu)} v záběru`;
  return (
    <div className="gantt-zoom" title="Přiblížení: tlačítka, posuvník nebo Ctrl + kolečko myši nad grafem">
      <span className="gantt-zoom-popisek">Přiblížení:</span>
      <button type="button" className="tlacitko-male" onClick={() => priblizit(null)} disabled={jePrehled}>
        Přehled
      </button>
      <button type="button" className="tlacitko-male" onClick={() => priblizit(sirkaDne / KROK_PRIBLIZENI)} disabled={jePrehled} aria-label="Oddálit">
        −
      </button>
      <input
        type="range"
        min={log(minSirka)}
        max={log(maxSirka)}
        step={0.01}
        value={log(sirkaDne)}
        onChange={(e) => priblizit(Math.exp(Number(e.target.value)))}
        aria-label="Přiblížení"
      />
      <button type="button" className="tlacitko-male" onClick={() => priblizit(sirkaDne * KROK_PRIBLIZENI)} disabled={sirkaDne >= maxSirka - 0.01} aria-label="Přiblížit">
        +
      </button>
      <button type="button" className="tlacitko-male" onClick={() => priblizit(maxSirka)} disabled={sirkaDne >= maxSirka - 0.01}>
        1 den
      </button>
      <span className="gantt-zoom-stav">{popisZaberu}</span>
    </div>
  );
}
