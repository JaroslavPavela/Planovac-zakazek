import { useMemo, useState } from 'react';
import { Board } from './ui/Board/Board';
import { Capacity } from './ui/Capacity';
import { GanttMachines } from './ui/Gantt/GanttMachines';
import { GanttPreparers } from './ui/Gantt/GanttPreparers';
import { spocitejOsu } from './ui/Gantt/lanes';
import { SettingsPanel } from './ui/SettingsPanel';
import { TopBar } from './ui/TopBar';
import { useRozvrh } from './ui/useRozvrh';
import { dnesIso, usePlanStore } from './store/planStore';

type Zalozka = 'tabule' | 'gantt-pripravari' | 'gantt-stroje' | 'vytizeni';

const ZALOZKY: { id: Zalozka; popisek: string }[] = [
  { id: 'tabule', popisek: 'Tabule' },
  { id: 'gantt-pripravari', popisek: 'Gantt přípraváři' },
  { id: 'gantt-stroje', popisek: 'Gantt stroje' },
  { id: 'vytizeni', popisek: 'Vytížení' },
];

export function App() {
  const rozvrh = useRozvrh();
  const zakazky = usePlanStore((s) => s.zakazky);
  const pripravari = usePlanStore((s) => s.pripravari);
  const prirazeni = usePlanStore((s) => s.prirazeni);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const [zalozka, setZalozka] = useState<Zalozka>('tabule');
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
            {sekce('tabule', <Board rozvrh={rozvrh} />)}
            {sekce('gantt-pripravari', <GanttPreparers rozvrh={rozvrh} dnes={dnes} zoom={zoom} setZoom={setZoom} pocetDnu={osa.dny.length} />)}
            {sekce('gantt-stroje', <GanttMachines rozvrh={rozvrh} dnes={dnes} zoom={zoom} setZoom={setZoom} pocetDnu={osa.dny.length} />)}
            {sekce('vytizeni', <Capacity rozvrh={rozvrh} osa={osa} />)}
          </>
        )}
      </main>
    </div>
  );
}
