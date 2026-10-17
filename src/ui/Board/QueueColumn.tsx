// Sloupec fronty stroje / kompletace (6.7): hlavička se souhrnem a karty v pořadí výsledné fronty (5.7).

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import { porovnej } from '../../domain/calendar';
import type { FazeRozvrh, NavazujiciFaze, Nastaveni, Rozvrh, RozvrhZakazky, Zakazka } from '../../domain/types';
import { formatDatum, formatHodiny, formatPracovniCas } from '../format';

export function idFronty(faze: NavazujiciFaze): string {
  return `fronta:${faze}`;
}
/** Id karty je jedinečné i napříč sloupci — stejná zakázka může být ve frontách více strojů. */
export function idKartyFronty(faze: NavazujiciFaze, cislo: string): string {
  return `fronta:${faze}:${cislo}`;
}

export interface DataKartyFronty {
  typ: 'karta';
  cislo: string;
  kontejner: string;
}

export function cekaVeFronte(f: FazeRozvrh): boolean {
  return f.pripraveno !== undefined && porovnej(f.pripraveno, f.start) < 0;
}

interface ObsahProps {
  zakazka: Zakazka;
  rozvrh: RozvrhZakazky;
  faze: NavazujiciFaze;
  hodDen: number;
  poradi: number; // pozice ve frontě od 0
}

export function ObsahKartyFronty({ zakazka, rozvrh, faze, hodDen, poradi }: ObsahProps) {
  const f = rozvrh.faze[faze];
  if (!f) return null;
  return (
    <>
      <div className="karta-titulek">
        <span className="karta-poradi">{poradi + 1}.</span> <strong>{zakazka.cislo}</strong> {zakazka.nazev}
      </div>
      <div className="karta-firma">{zakazka.firma}</div>
      <div className="karta-hodiny">
        <span>{formatHodiny(f.hodiny)} h</span>
        <span>připraveno {formatPracovniCas(f.pripraveno, hodDen)}</span>
      </div>
      <div className="karta-terminy">
        <span>
          {formatPracovniCas(f.start, hodDen)} → {formatPracovniCas(f.konec, hodDen)}
        </span>
        <span>
          Dokončení <strong>{formatDatum(rozvrh.predpokladaneDokonceni?.den)}</strong> · termín <strong>{formatDatum(zakazka.terminDokonceni)}</strong>
        </span>
      </div>
      {cekaVeFronte(f) && <span className="stitek stitek-ceka">čeká ve frontě</span>}
    </>
  );
}

function KartaFronty({ zakazka, rozvrh, faze, hodDen, poradi, onDetail }: ObsahProps & { onDetail: (cislo: string) => void }) {
  const kontejner = idFronty(faze);
  const data: DataKartyFronty = { typ: 'karta', cislo: zakazka.cislo, kontejner };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idKartyFronty(faze, zakazka.cislo), data });
  const styl: CSSProperties = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={styl}
      className={`karta stav-${rozvrh.stav}`}
      {...attributes}
      {...listeners}
      onClick={() => onDetail(zakazka.cislo)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDetail(zakazka.cislo);
      }}
    >
      <ObsahKartyFronty zakazka={zakazka} rozvrh={rozvrh} faze={faze} hodDen={hodDen} poradi={poradi} />
    </div>
  );
}

interface Props {
  faze: NavazujiciFaze;
  nazev: string;
  zakazky: Zakazka[]; // v pořadí výsledné fronty
  rucniPoradi: boolean; // fronta má uložené ruční pořadí
  mrizka?: boolean; // karty v mřížce (jediné pracoviště na šířku tabule), jinak pod sebou
  rozvrh: Rozvrh;
  nastaveni: Nastaveni;
  onDetail: (cislo: string) => void;
  onSeradit: (faze: NavazujiciFaze) => void;
}

export function QueueColumn({ faze, nazev, zakazky, rucniPoradi, mrizka, rozvrh, nastaveni, onDetail, onSeradit }: Props) {
  const id = idFronty(faze);
  const { setNodeRef } = useDroppable({ id, data: { typ: 'kontejner', kontejner: id } });
  const hodDen = nastaveni.hodDenStroj[faze];
  const hodiny = zakazky.reduce((s, z) => s + (rozvrh.zakazky[z.cislo]?.faze[faze]?.hodiny ?? 0), 0);
  const posledni = zakazky.length > 0 ? rozvrh.zakazky[zakazky[zakazky.length - 1].cislo]?.faze[faze] : undefined;
  return (
    <section ref={setNodeRef} className={`sloupec sloupec-fronta${mrizka ? ' sloupec-mrizka' : ''}`}>
      <header className="sloupec-hlavicka">
        <h2>{nazev}</h2>
        <div className="sloupec-info">
          <span>
            {zakazky.length} zak. · {formatHodiny(hodiny)} h
          </span>
          <span>konec fronty {posledni ? formatPracovniCas(posledni.konec, hodDen, 'd. M. yyyy') : '—'}</span>
        </div>
        <div className="sloupec-info">
          <span>pořadí: {rucniPoradi ? 'ruční' : 'podle připravenosti'}</span>
        </div>
        <button type="button" className="tlacitko-male" onClick={() => onSeradit(faze)} disabled={!rucniPoradi}>
          Seřadit podle připravenosti
        </button>
      </header>
      <SortableContext items={zakazky.map((z) => idKartyFronty(faze, z.cislo))} strategy={mrizka ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className="sloupec-telo">
          {zakazky.map((z, i) => (
            <KartaFronty key={z.cislo} zakazka={z} rozvrh={rozvrh.zakazky[z.cislo]} faze={faze} hodDen={hodDen} poradi={i} onDetail={onDetail} />
          ))}
          {zakazky.length === 0 && <p className="prazdne">Žádná přiřazená zakázka nemá hodiny na tomto pracovišti.</p>}
        </div>
      </SortableContext>
    </section>
  );
}
