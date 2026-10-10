import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import type { Nastaveni, RozvrhZakazky, Zakazka } from '../../domain/types';
import { formatDatum, formatHodiny, formatPracovniCas } from '../format';

export const ID_ZASOBNIK = 'zasobnik';
export function idPripravare(pripravarId: string): string {
  return `pripravar:${pripravarId}`;
}
export function idKarty(cislo: string): string {
  return `zakazka:${cislo}`;
}

export interface DataKarty {
  typ: 'karta';
  cislo: string;
  kontejner: string;
}

interface Props {
  zakazka: Zakazka;
  rozvrh: RozvrhZakazky;
  nastaveni: Nastaveni;
  kontejner: string;
  onDetail: (cislo: string) => void;
  prekryv?: boolean; // vykreslení v DragOverlay
}

export function ObsahKarty({ zakazka, rozvrh, nastaveni }: Pick<Props, 'zakazka' | 'rozvrh' | 'nastaveni'>) {
  const vZasobniku = !rozvrh.pripravarId;
  const tpv = rozvrh.faze.tpv;
  return (
    <>
      <div className="karta-titulek">
        <strong>{zakazka.cislo}</strong> {zakazka.nazev}
      </div>
      <div className="karta-firma">{zakazka.firma}</div>
      <div className="karta-hodiny" title={`TPV · S1 = ${nastaveni.nazvyStroju.stroj1} · S2 = ${nastaveni.nazvyStroju.stroj2} · S3 = ${nastaveni.nazvyStroju.stroj3} · K = Kompletace`}>
        <span>TPV {formatHodiny(zakazka.tpvHod)}</span>
        <span>S1 {formatHodiny(zakazka.stroj1Hod)}</span>
        <span>S2 {formatHodiny(zakazka.stroj2Hod)}</span>
        <span>S3 {formatHodiny(zakazka.stroj3Hod)}</span>
        <span>K {formatHodiny(zakazka.kompletaceHod)}</span>
      </div>
      <div className="karta-terminy">
        <span>
          Termín <strong>{formatDatum(zakazka.terminDokonceni)}</strong>
        </span>
        {vZasobniku ? (
          <span>
            Nejpozdější start TPV <strong>{formatDatum(rozvrh.nejpozdejsiStartTpv)}</strong>
          </span>
        ) : (
          <>
            <span>
              TPV {tpv ? `${formatPracovniCas(tpv.start, nastaveni.hodDenPripravar)} → ${formatPracovniCas(tpv.konec, nastaveni.hodDenPripravar)}` : 'bez přípravy'}
            </span>
            <span>
              Dokončení <strong>{formatDatum(rozvrh.predpokladaneDokonceni?.den)}</strong>
            </span>
          </>
        )}
      </div>
      {rozvrh.nestihnutelne && <span className="stitek stitek-nestihnutelne">nestihnutelné</span>}
    </>
  );
}

export function OrderCard({ zakazka, rozvrh, nastaveni, kontejner, onDetail, prekryv }: Props) {
  const data: DataKarty = { typ: 'karta', cislo: zakazka.cislo, kontejner };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idKarty(zakazka.cislo), data });
  const styl: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !prekryv ? 0.35 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={styl}
      className={`karta stav-${rozvrh.stav}${prekryv ? ' karta-prekryv' : ''}`}
      {...attributes}
      {...listeners}
      onClick={() => onDetail(zakazka.cislo)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDetail(zakazka.cislo);
      }}
    >
      <ObsahKarty zakazka={zakazka} rozvrh={rozvrh} nastaveni={nastaveni} />
    </div>
  );
}
