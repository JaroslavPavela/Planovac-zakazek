import { useDroppable } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { SortingStrategy } from '@dnd-kit/sortable';
import type { Nastaveni, Rozvrh, Zakazka } from '../../domain/types';
import { ID_ZASOBNIK, OrderCard, idKarty } from './OrderCard';

interface Props {
  zakazky: Zakazka[]; // seřazené podle termínu dokončení
  rozvrh: Rozvrh;
  nastaveni: Nastaveni;
  zvyraznit: boolean;
  onDetail: (cislo: string) => void;
}

/** Zásobník se nepřeuspořádává (pořadí dává termín), karty se při tažení neposouvají. */
const bezPosunu: SortingStrategy = () => null;

export function Backlog({ zakazky, rozvrh, nastaveni, zvyraznit, onDetail }: Props) {
  const { setNodeRef } = useDroppable({ id: ID_ZASOBNIK, data: { typ: 'kontejner', kontejner: ID_ZASOBNIK } });
  const nestihnutelne = zakazky.filter((z) => rozvrh.zakazky[z.cislo]?.nestihnutelne).length;
  return (
    <section ref={setNodeRef} className={`sloupec zasobnik${zvyraznit ? ' sloupec-nad' : ''}`}>
      <header className="sloupec-hlavicka">
        <h2>Zásobník</h2>
        <div className="sloupec-info">
          <span>{zakazky.length} zakázek</span>
          {nestihnutelne > 0 && <span className="stav-pozde">{nestihnutelne} nestihnutelných</span>}
        </div>
      </header>
      <SortableContext items={zakazky.map((z) => idKarty(z.cislo))} strategy={bezPosunu}>
        <div className="sloupec-telo">
          {zakazky.map((z) => (
            <OrderCard key={z.cislo} zakazka={z} rozvrh={rozvrh.zakazky[z.cislo]} nastaveni={nastaveni} kontejner={ID_ZASOBNIK} onDetail={onDetail} />
          ))}
          {zakazky.length === 0 && <p className="prazdne">Všechny zakázky jsou přiřazené.</p>}
        </div>
      </SortableContext>
    </section>
  );
}
