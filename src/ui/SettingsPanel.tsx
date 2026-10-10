import { STROJE, STROJ_POPISEK } from '../domain/types';
import type { StrojId } from '../domain/types';
import { usePlanStore } from '../store/planStore';

function CisloVstup({ hodnota, onZmena, min = 0.5, krok = 0.5 }: { hodnota: number; onZmena: (n: number) => void; min?: number; krok?: number }) {
  return (
    <input
      type="number"
      min={min}
      step={krok}
      value={hodnota}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n >= min) onZmena(n);
      }}
    />
  );
}

export function SettingsPanel({ onZavrit }: { onZavrit: () => void }) {
  const pripravari = usePlanStore((s) => s.pripravari);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const prejmenuj = usePlanStore((s) => s.prejmenujPripravare);
  const upravNastaveni = usePlanStore((s) => s.upravNastaveni);
  const nastavHodDenStroje = usePlanStore((s) => s.nastavHodDenStroje);
  const prejmenujStroj = usePlanStore((s) => s.prejmenujStroj);

  return (
    <section className="panel-nastaveni">
      <div className="panel-nastaveni-sloupec">
        <h3>Přípraváři</h3>
        {pripravari.map((p) => (
          <label key={p.id} className="radek-formulare">
            <span>{p.id.toUpperCase()}</span>
            <input type="text" value={p.nazev} onChange={(e) => prejmenuj(p.id, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="panel-nastaveni-sloupec">
        <h3>Hodiny / den</h3>
        <label className="radek-formulare">
          <span>Přípravář</span>
          <CisloVstup hodnota={nastaveni.hodDenPripravar} onZmena={(n) => upravNastaveni({ hodDenPripravar: n })} />
        </label>
        {STROJE.map((s: StrojId) => (
          <div key={s} className="radek-formulare radek-stroje">
            <input
              type="text"
              value={nastaveni.nazvyStroju[s]}
              placeholder={STROJ_POPISEK[s]}
              onChange={(e) => prejmenujStroj(s, e.target.value)}
              aria-label={`Název stroje ${STROJ_POPISEK[s]}`}
              title={`Název stroje (ve vstupním xlsx zůstává sloupec „${STROJ_POPISEK[s]} [h]“)`}
            />
            <CisloVstup hodnota={nastaveni.hodDenStroj[s]} onZmena={(n) => nastavHodDenStroje(s, n)} />
          </div>
        ))}
        <label className="radek-formulare">
          <span>{STROJ_POPISEK.kompletace} / ohýbání</span>
          <CisloVstup hodnota={nastaveni.hodDenStroj.kompletace} onZmena={(n) => nastavHodDenStroje('kompletace', n)} />
        </label>
        <p className="napoveda">
          Hodiny strojů jsou strojní hodiny; délka fáze = hodiny / (hodiny/den). Názvy strojů jsou jen pro zobrazení, ve vstupním xlsx zůstávají
          sloupce Stroj 1–3 [h].
        </p>
        <button type="button" onClick={onZavrit}>
          Zavřít nastavení
        </button>
      </div>
    </section>
  );
}
