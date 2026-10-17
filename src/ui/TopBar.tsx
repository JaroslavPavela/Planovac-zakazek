import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { exportujXlsx, nazevSouboruExportu } from '../import/xlsxExport';
import { nactiXlsx } from '../import/xlsxImport';
import type { VysledekImportu } from '../import/xlsxImport';
import { dnesIso, stavAplikace, usePlanStore } from '../store/planStore';
import type { Rozvrh } from '../domain/types';
import { ImportSummary } from './ImportSummary';
import { Potvrzeni } from './Dialog';

interface Props {
  rozvrh: Rozvrh;
  nastaveniOtevrene: boolean;
  onPrepnoutNastaveni: () => void;
  onOtevritNastaveni: () => void;
}

export function TopBar({ rozvrh, nastaveniOtevrene, onPrepnoutNastaveni, onOtevritNastaveni }: Props) {
  const zakazky = usePlanStore((s) => s.zakazky);
  const pripravari = usePlanStore((s) => s.pripravari);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const minulost = usePlanStore((s) => s.minulost);
  const budoucnost = usePlanStore((s) => s.budoucnost);
  const nahradData = usePlanStore((s) => s.nahradData);
  const upravNastaveni = usePlanStore((s) => s.upravNastaveni);
  const navrhni = usePlanStore((s) => s.navrhniRozdeleni);
  const zpet = usePlanStore((s) => s.zpet);
  const znovu = usePlanStore((s) => s.znovu);
  const vymazVse = usePlanStore((s) => s.vymazVse);

  const vstupSouboru = useRef<HTMLInputElement>(null);
  const [cekajiciSoubor, setCekajiciSoubor] = useState<File | null>(null);
  const [souhrn, setSouhrn] = useState<{ vysledek: VysledekImportu; nazev: string } | null>(null);
  const [potvrditMazani, setPotvrditMazani] = useState(false);

  const stavy = Object.values(rozvrh.zakazky);
  const prirazeno = stavy.filter((z) => z.pripravarId).length;
  const pozde = stavy.filter((z) => z.stav === 'pozde').length;
  const ohrozeno = stavy.filter((z) => z.stav === 'ohrozeno').length;

  function vybranSoubor(e: ChangeEvent<HTMLInputElement>) {
    const soubor = e.target.files?.[0];
    e.target.value = '';
    if (!soubor) return;
    if (zakazky.length === 0) void nactiSoubor(soubor);
    else setCekajiciSoubor(soubor);
  }

  async function nactiSoubor(soubor: File) {
    setCekajiciSoubor(null);
    const data = new Uint8Array(await soubor.arrayBuffer());
    let vysledek: VysledekImportu;
    try {
      vysledek = nactiXlsx(data, pripravari);
    } catch (chyba) {
      vysledek = { ok: false, chybejiciSloupce: [] };
      console.error('Import selhal', chyba);
    }
    if (vysledek.ok) {
      nahradData(vysledek.zakazky, vysledek.prirazeni, vysledek.poradiFaze);
      onOtevritNastaveni();
    }
    setSouhrn({ vysledek, nazev: soubor.name });
  }

  function exportovat() {
    const data = exportujXlsx(stavAplikace(usePlanStore.getState()), rozvrh);
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nazevSouboruExportu(dnesIso());
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <header className="top-bar">
      <h1>Plánovač zakázek TPV</h1>

      <div className="skupina">
        <input ref={vstupSouboru} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={vybranSoubor} />
        <button type="button" className="tlacitko-primarni" onClick={() => vstupSouboru.current?.click()}>
          Načíst xlsx
        </button>
        <button type="button" onClick={exportovat} disabled={zakazky.length === 0}>
          Export xlsx
        </button>
        <button type="button" onClick={() => window.print()}>
          Tisk
        </button>
      </div>

      <div className="skupina">
        <label>
          Začátek plánu
          <input type="date" value={nastaveni.zacatekPlanu} onChange={(e) => e.target.value && upravNastaveni({ zacatekPlanu: e.target.value })} />
        </label>
        <label>
          Rezerva
          <input
            type="number"
            min={0}
            step={1}
            value={nastaveni.rezervaDny}
            onChange={(e) => upravNastaveni({ rezervaDny: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            title="Rezerva v pracovních dnech před termínem dokončení"
          />
          <span className="jednotka">prac. dnů</span>
        </label>
        <button type="button" onClick={onPrepnoutNastaveni} aria-pressed={nastaveniOtevrene}>
          Nastavení
        </button>
      </div>

      <div className="skupina">
        <button type="button" onClick={navrhni} disabled={prirazeno === zakazky.length}>
          Navrhnout rozdělení
        </button>
        <button type="button" onClick={zpet} disabled={minulost.length === 0} title="Zpět (přiřazení a pořadí front)">
          ↶ Zpět
        </button>
        <button type="button" onClick={znovu} disabled={budoucnost.length === 0} title="Znovu">
          ↷ Znovu
        </button>
        <button type="button" className="tlacitko-nebezpecne-tiche" onClick={() => setPotvrditMazani(true)} disabled={zakazky.length === 0}>
          Vymazat vše
        </button>
      </div>

      <div className="souhrn">
        <span>
          Zakázek: <strong>{zakazky.length}</strong>
        </span>
        <span>
          přiřazeno <strong>{prirazeno}</strong> / v zásobníku <strong>{zakazky.length - prirazeno}</strong>
        </span>
        <span className={pozde ? 'stav-pozde' : ''}>
          pozdě <strong>{pozde}</strong>
        </span>
        <span className={ohrozeno ? 'stav-ohrozeno' : ''}>
          ohroženo <strong>{ohrozeno}</strong>
        </span>
      </div>

      {cekajiciSoubor && (
        <Potvrzeni
          titulek="Načíst soubor"
          text={`Načtení souboru „${cekajiciSoubor.name}“ nahradí všechna aktuální data (zakázky i přiřazení). Nastavení zůstane.`}
          potvrdit="Načíst a nahradit"
          onPotvrdit={() => void nactiSoubor(cekajiciSoubor)}
          onZrusit={() => setCekajiciSoubor(null)}
        />
      )}
      {souhrn && <ImportSummary vysledek={souhrn.vysledek} nazevSouboru={souhrn.nazev} onZavrit={() => setSouhrn(null)} />}
      {potvrditMazani && (
        <Potvrzeni
          titulek="Vymazat vše"
          text="Smažou se všechny zakázky, přiřazení i nastavení. Tuto akci nelze vrátit."
          potvrdit="Vymazat"
          nebezpecne
          onPotvrdit={() => {
            vymazVse();
            setPotvrditMazani(false);
          }}
          onZrusit={() => setPotvrditMazani(false)}
        />
      )}
    </header>
  );
}
