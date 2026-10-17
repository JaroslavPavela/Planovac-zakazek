import { useMemo, useState } from 'react';
import { Board } from './ui/Board/Board';
import { QueueBoard } from './ui/Board/QueueBoard';
import { Capacity } from './ui/Capacity';
import { GanttMachines } from './ui/Gantt/GanttMachines';
import { GanttPreparers } from './ui/Gantt/GanttPreparers';
import { spocitejOsu } from './ui/Gantt/lanes';
import { SettingsPanel } from './ui/SettingsPanel';
import { TopBar } from './ui/TopBar';
import { useRozvrh } from './ui/useRozvrh';
import { dnesIso, usePlanStore } from './store/planStore';
import { STROJE } from './domain/types';
import type { NavazujiciFaze } from './domain/types';

type Zalozka = 'priprava' | 'stroje' | 'kompletace' | 'vytizeni';

const ZALOZKY: { id: Zalozka; popisek: string }[] = [
  { id: 'priprava', popisek: 'Příprava' },
  { id: 'stroje', popisek: 'Stroje' },
  { id: 'kompletace', popisek: 'Kompletace' },
  { id: 'vytizeni', popisek: 'Vytížení' },
];

const KOMPLETACE: readonly NavazujiciFaze[] = ['kompletace'];

export function App() {
  const rozvrh = useRozvrh();
  const zakazky = usePlanStore((s) => s.zakazky);
  const pripravari = usePlanStore((s) => s.pripravari);
  const prirazeni = usePlanStore((s) => s.prirazeni);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const [zalozka, setZalozka] = useState<Zalozka>('priprava');
  const [nastaveniOtevrene, setNastaveniOtevrene] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null); // přiblížení Ganttů, null = přehled

  const dnes = dnesIso();
  const osa = useMemo(
    () => spocitejOsu({ zakazky, pripravari, prirazeni, nastaveni }, rozvrh, dnes),
    [zakazky, pripravari, prirazeni, nastaveni, rozvrh, dnes],
  );

  // Všechny sekce jsou vykreslené (kvůli tisku všech najednou); na obrazovce je vidět jen aktivní záložka.
  const sekce = (id: Zalozka, obsah: JSX.Element) => (
    <section className={`sekce${zalozka === id ? ' sekce-aktivni' : ''}`} aria-hidden={zalozka !== id}>
      <h2 className="sekce-nadpis-tisk">{ZALOZKY.find((z) => z.id === id)!.popisek}</h2>
      {obsah}
    </section>
  );

  return (
    <div className="app">
      <TopBar
        rozvrh={rozvrh}
        nastaveniOtevrene={nastaveniOtevrene}
        onPrepnoutNastaveni={() => setNastaveniOtevrene((v) => !v)}
        onOtevritNastaveni={() => setNastaveniOtevrene(true)}
      />
      {nastaveniOtevrene && <SettingsPanel onZavrit={() => setNastaveniOtevrene(false)} />}
      <nav className="zalozky">
        {ZALOZKY.map((z) => (
          <button key={z.id} type="button" className={zalozka === z.id ? 'aktivni' : ''} onClick={() => setZalozka(z.id)}>
            {z.popisek}
          </button>
        ))}
      </nav>
      <main className="obsah">
        {zakazky.length === 0 ? (
          <p className="prazdne-uvod">Načtěte xlsx se zakázkami tlačítkem „Načíst xlsx“. Vzor je v souboru vzor/zakazky-vzor.xlsx.</p>
        ) : (
          <>
            {sekce(
              'priprava',
              <div className="cast">
                <GanttPreparers rozvrh={rozvrh} dnes={dnes} zoom={zoom} setZoom={setZoom} pocetDnu={osa.dny.length} />
                <Board rozvrh={rozvrh} />
              </div>,
            )}
            {sekce(
              'stroje',
              <div className="cast">
                <GanttMachines radky={STROJE} rozvrh={rozvrh} dnes={dnes} zoom={zoom} setZoom={setZoom} pocetDnu={osa.dny.length} />
                <QueueBoard faze={STROJE} rozvrh={rozvrh} />
              </div>,
            )}
            {sekce(
              'kompletace',
              <div className="cast">
                <GanttMachines radky={KOMPLETACE} rozvrh={rozvrh} dnes={dnes} zoom={zoom} setZoom={setZoom} pocetDnu={osa.dny.length} />
                <QueueBoard faze={KOMPLETACE} rozvrh={rozvrh} />
              </div>,
            )}
            {sekce('vytizeni', <Capacity rozvrh={rozvrh} osa={osa} />)}
          </>
        )}
      </main>
    </div>
  );
}
