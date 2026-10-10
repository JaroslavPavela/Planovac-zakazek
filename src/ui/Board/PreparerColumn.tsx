import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Nastaveni, Pripravar, Rozvrh, Zakazka } from '../../domain/types';
import { formatDatum, formatHodiny } from '../format';
import { OrderCard, idKarty, idPripravare } from './OrderCard';

interface Props {
  pripravar: Pripravar;
  zakazky: Zakazka[]; // v pořadí fronty
  rozvrh: Rozvrh;
  nastaveni: Nastaveni;
  zvyraznit: boolean;
  onDetail: (cislo: string) => void;
  onSeradit: (pripravarId: string) => void;
}

export function PreparerColumn({ pripravar, zakazky, rozvrh, nastaveni, zvyraznit, onDetail, onSeradit }: Props) {
  const id = idPripravare(pripravar.id);
  const { setNodeRef } = useDroppable({ id, data: { typ: 'kontejner', kontejner: id } });
  const hodinyTpv = zakazky.reduce((s, z) => s + z.tpvHod, 0);
  const konec = rozvrh.konecFronty[pripravar.id];
  return (
    <section ref={setNodeRef} className={`sloupec sloupec-pripravar${zvyraznit ? ' sloupec-nad' : ''}`}>
      <header className="sloupec-hlavicka">
        <h2>{pripravar.nazev}</h2>
        <div className="sloupec-info">
          <span>TPV {formatHodiny(hodinyTpv)} h</span>
          <span>konec fronty {zakazky.length > 0 ? formatDatum(konec?.den) : '—'}</span>
        </div>
        <button type="button" className="tlacitko-male" onClick={() => onSeradit(pripravar.id)} disabled={zakazky.length < 2}>
          Seřadit podle termínu
        </button>
      </header>
      <SortableContext items={zakazky.map((z) => idKarty(z.cislo))} strategy={verticalListSortingStrategy}>
        <div className="sloupec-telo">
          {zakazky.map((z) => (
            <OrderCard key={z.cislo} zakazka={z} rozvrh={rozvrh.zakazky[z.cislo]} nastaveni={nastaveni} kontejner={id} onDetail={onDetail} />
          ))}
          {zakazky.length === 0 && <p className="prazdne">Přetáhněte sem zakázku.</p>}
        </div>
      </SortableContext>
    </section>
  );
}
