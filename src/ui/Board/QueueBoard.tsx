// Tabule front strojů / kompletace (6.7): sloupec = pracoviště, karty v pořadí fronty; drag & drop jen v rámci sloupce
// (hodiny patří konkrétnímu stroji). Přesun uloží ruční pořadí fronty a je vratný (Zpět / Znovu).

import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { NavazujiciFaze, Rozvrh } from '../../domain/types';
import { usePlanStore } from '../../store/planStore';
import { popisekPracoviste } from '../Gantt/GanttMachines';
import { OrderDetail } from './OrderDetail';
import { ObsahKartyFronty, QueueColumn, idFronty } from './QueueColumn';
import type { DataKartyFronty } from './QueueColumn';

/** Cílem přetažení může být jen karta ve stejném sloupci jako tažená karta. */
const detekceKolizi: CollisionDetection = (args) => {
  const kontejner = (args.active.data.current as DataKartyFronty | undefined)?.kontejner;
  const karty = args.droppableContainers.filter((c) => c.data.current?.typ === 'karta' && c.data.current.kontejner === kontejner);
  return closestCenter({ ...args, droppableContainers: karty });
};

interface Tazena {
  faze: NavazujiciFaze;
  cislo: string;
}

export function QueueBoard({ faze: fazeSloupcu, rozvrh }: { faze: readonly NavazujiciFaze[]; rozvrh: Rozvrh }) {
  const zakazky = usePlanStore((s) => s.zakazky);
  const pripravari = usePlanStore((s) => s.pripravari);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const poradiFaze = usePlanStore((s) => s.poradiFaze);
  const presunVeFronte = usePlanStore((s) => s.presunVeFronte);
  const seradFrontuFaze = usePlanStore((s) => s.seradFrontuFaze);

  const [tazena, setTazena] = useState<Tazena | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const podleCisla = useMemo(() => new Map(zakazky.map((z) => [z.cislo, z])), [zakazky]);
  const kontejnerFaze = (kontejner: string) => fazeSloupcu.find((f) => idFronty(f) === kontejner);

  function konecTazeni(e: DragEndEvent) {
    setTazena(null);
    const data = e.active.data.current as DataKartyFronty | undefined;
    const cil = e.over?.data.current as DataKartyFronty | undefined;
    if (!data || !cil || cil.typ !== 'karta' || cil.kontejner !== data.kontejner) return;
    const faze = kontejnerFaze(data.kontejner);
    if (!faze) return;
    const index = rozvrh.frontyFaze[faze].indexOf(cil.cislo);
    if (index < 0 || cil.cislo === data.cislo) return;
    presunVeFronte(faze, data.cislo, index);
  }

  const tazenaZakazka = tazena ? podleCisla.get(tazena.cislo) : undefined;
  const detailZakazka = detail ? podleCisla.get(detail) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detekceKolizi}
      onDragStart={(e: DragStartEvent) => {
        const data = e.active.data.current as DataKartyFronty;
        const faze = kontejnerFaze(data.kontejner);
        setTazena(faze ? { faze, cislo: data.cislo } : null);
      }}
      onDragEnd={konecTazeni}
      onDragCancel={() => setTazena(null)}
    >
      <div className="tabule tabule-fronty">
        {fazeSloupcu.map((faze) => {
          const fronta = rozvrh.frontyFaze[faze];
          return (
            <QueueColumn
              key={faze}
              faze={faze}
              nazev={popisekPracoviste(nastaveni, faze)}
              zakazky={fronta.map((c) => podleCisla.get(c)!).filter(Boolean)}
              rucniPoradi={poradiFaze[faze].some((c) => fronta.includes(c))}
              mrizka={fazeSloupcu.length === 1}
              rozvrh={rozvrh}
              nastaveni={nastaveni}
              onDetail={setDetail}
              onSeradit={seradFrontuFaze}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {tazena && tazenaZakazka && (
          <div className={`karta karta-prekryv stav-${rozvrh.zakazky[tazena.cislo].stav}`}>
            <ObsahKartyFronty
              zakazka={tazenaZakazka}
              rozvrh={rozvrh.zakazky[tazena.cislo]}
              faze={tazena.faze}
              hodDen={nastaveni.hodDenStroj[tazena.faze]}
              poradi={rozvrh.frontyFaze[tazena.faze].indexOf(tazena.cislo)}
            />
          </div>
        )}
      </DragOverlay>
      {detailZakazka && rozvrh.zakazky[detailZakazka.cislo] && (
        <OrderDetail zakazka={detailZakazka} rozvrh={rozvrh.zakazky[detailZakazka.cislo]} nastaveni={nastaveni} pripravari={pripravari} onZavrit={() => setDetail(null)} />
      )}
    </DndContext>
  );
}
