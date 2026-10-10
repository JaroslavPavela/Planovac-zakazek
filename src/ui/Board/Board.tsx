import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, rectIntersection, useSensor, useSensors } from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { frontaPripravare } from '../../domain/prirazeni';
import type { Rozvrh } from '../../domain/types';
import { usePlanStore } from '../../store/planStore';
import { Backlog } from './Backlog';
import { ID_ZASOBNIK, ObsahKarty, idPripravare } from './OrderCard';
import type { DataKarty } from './OrderCard';
import { OrderDetail } from './OrderDetail';
import { PreparerColumn } from './PreparerColumn';

/**
 * Detekce kolizí pro tabuli: nejdřív se podle ukazatele určí kontejner (zásobník / sloupec přípraváře),
 * teprve v něm nejbližší karta. Obecné `closestCorners` u vysokých sloupců vybíralo karty sousedního sloupce.
 */
const detekceKolizi: CollisionDetection = (args) => {
  const kontejnery = args.droppableContainers.filter((c) => c.data.current?.typ === 'kontejner');
  const nadKontejnerem = args.pointerCoordinates ? pointerWithin({ ...args, droppableContainers: kontejnery }) : [];
  const kontejner = nadKontejnerem[0] ?? rectIntersection({ ...args, droppableContainers: kontejnery })[0];
  if (!kontejner) return [];
  const karty = args.droppableContainers.filter((c) => c.data.current?.typ === 'karta' && c.data.current.kontejner === kontejner.id);
  const nejblizsi = closestCenter({ ...args, droppableContainers: karty });
  return nejblizsi.length > 0 ? nejblizsi : [kontejner];
};

/** Id kontejneru, nad kterým se právě táhne (kontejner karty, nebo přímo kontejner). */
function cilKontejneru(over: DragOverEvent['over']): string | null {
  if (!over) return null;
  const data = over.data.current as { typ?: string; kontejner?: string } | undefined;
  return data?.kontejner ?? String(over.id);
}

export function Board({ rozvrh }: { rozvrh: Rozvrh }) {
  const zakazky = usePlanStore((s) => s.zakazky);
  const pripravari = usePlanStore((s) => s.pripravari);
  const prirazeni = usePlanStore((s) => s.prirazeni);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const presun = usePlanStore((s) => s.presunZakazku);
  const seradFrontu = usePlanStore((s) => s.seradFrontu);

  const [tazena, setTazena] = useState<string | null>(null);
  const [cil, setCil] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const podleCisla = useMemo(() => new Map(zakazky.map((z) => [z.cislo, z])), [zakazky]);
  const fronty = useMemo(
    () =>
      Object.fromEntries(
        pripravari.map((p) => [p.id, frontaPripravare(prirazeni, p.id).map((c) => podleCisla.get(c)!).filter(Boolean)]),
      ),
    [pripravari, prirazeni, podleCisla],
  );
  const zasobnik = useMemo(() => {
    const prirazene = new Set(prirazeni.map((p) => p.zakazkaCislo));
    return zakazky
      .filter((z) => !prirazene.has(z.cislo))
      .sort((a, b) => a.terminDokonceni.localeCompare(b.terminDokonceni) || a.terminZadani.localeCompare(b.terminZadani) || a.cislo.localeCompare(b.cislo));
  }, [zakazky, prirazeni]);

  function konecTazeni(e: DragEndEvent) {
    setTazena(null);
    setCil(null);
    const { active, over } = e;
    const cil = cilKontejneru(over);
    if (!over || !cil) return;
    const data = active.data.current as DataKarty | undefined;
    if (!data || data.typ !== 'karta') return;
    const overData = over.data.current as { typ: string; kontejner: string; cislo?: string } | undefined;

    if (cil === ID_ZASOBNIK) {
      if (data.kontejner !== ID_ZASOBNIK) presun(data.cislo, null);
      return;
    }
    const pripravar = pripravari.find((p) => idPripravare(p.id) === cil);
    if (!pripravar) return;
    const seznam = fronty[pripravar.id].map((z) => z.cislo);
    let index = seznam.length;
    if (overData?.typ === 'karta' && overData.cislo) {
      index = seznam.indexOf(overData.cislo);
      if (index < 0) index = seznam.length;
    }
    if (data.kontejner === cil && seznam.indexOf(data.cislo) === index) return;
    presun(data.cislo, pripravar.id, index);
  }

  const tazenaZakazka = tazena ? podleCisla.get(tazena) : undefined;
  const detailZakazka = detail ? podleCisla.get(detail) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detekceKolizi}
      onDragStart={(e: DragStartEvent) => setTazena((e.active.data.current as DataKarty).cislo)}
      onDragOver={(e: DragOverEvent) => setCil(cilKontejneru(e.over))}
      onDragEnd={konecTazeni}
      onDragCancel={() => {
        setTazena(null);
        setCil(null);
      }}
    >
      <div className="tabule">
        <Backlog zakazky={zasobnik} rozvrh={rozvrh} nastaveni={nastaveni} zvyraznit={cil === ID_ZASOBNIK} onDetail={setDetail} />
        <div className="sloupce-pripravaru">
          {pripravari.map((p) => (
            <PreparerColumn
              key={p.id}
              pripravar={p}
              zakazky={fronty[p.id]}
              rozvrh={rozvrh}
              nastaveni={nastaveni}
              zvyraznit={cil === idPripravare(p.id)}
              onDetail={setDetail}
              onSeradit={seradFrontu}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {tazenaZakazka && (
          <div className={`karta karta-prekryv stav-${rozvrh.zakazky[tazenaZakazka.cislo].stav}`}>
            <ObsahKarty zakazka={tazenaZakazka} rozvrh={rozvrh.zakazky[tazenaZakazka.cislo]} nastaveni={nastaveni} />
          </div>
        )}
      </DragOverlay>
      {detailZakazka && rozvrh.zakazky[detailZakazka.cislo] && (
        <OrderDetail zakazka={detailZakazka} rozvrh={rozvrh.zakazky[detailZakazka.cislo]} nastaveni={nastaveni} pripravari={pripravari} onZavrit={() => setDetail(null)} />
      )}
    </DndContext>
  );
}
