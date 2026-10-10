import { Dialog } from './Dialog';
import { NAZVY_SLOUPCU } from '../import/headers';
import type { VysledekImportu } from '../import/xlsxImport';

interface Props {
  vysledek: VysledekImportu;
  nazevSouboru: string;
  onZavrit: () => void;
}

export function ImportSummary({ vysledek, nazevSouboru, onZavrit }: Props) {
  const akce = (
    <button type="button" className="tlacitko-primarni" onClick={onZavrit} autoFocus>
      OK
    </button>
  );

  if (!vysledek.ok) {
    return (
      <Dialog titulek="Import se nezdařil" onZavrit={onZavrit} akce={akce}>
        <p>
          Soubor <strong>{nazevSouboru}</strong> nemá všechny povinné sloupce. Nic se nenačetlo.
        </p>
        <p>Chybějící sloupce:</p>
        <ul>
          {vysledek.chybejiciSloupce.map((k) => (
            <li key={k}>{NAZVY_SLOUPCU[k]}</li>
          ))}
        </ul>
      </Dialog>
    );
  }

  return (
    <Dialog titulek="Souhrn importu" onZavrit={onZavrit} akce={akce}>
      <p>
        Soubor <strong>{nazevSouboru}</strong>: načteno <strong>{vysledek.zakazky.length}</strong> zakázek z {vysledek.pocetRadku} řádků,
        obnoveno {vysledek.prirazeni.length} přiřazení.
      </p>
      {vysledek.preskocene.length > 0 && (
        <>
          <h3>Přeskočené řádky ({vysledek.preskocene.length})</h3>
          <ul className="seznam-chyb">
            {vysledek.preskocene.map((p) => (
              <li key={p.radek}>
                Řádek {p.radek}: {p.duvod}
              </li>
            ))}
          </ul>
        </>
      )}
      {vysledek.varovani.length > 0 && (
        <>
          <h3>Varování ({vysledek.varovani.length})</h3>
          <ul className="seznam-varovani">
            {vysledek.varovani.map((v, i) => (
              <li key={i}>
                Řádek {v.radek} ({v.cislo}): {v.text}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="napoveda">Po zavření zkontrolujte hodiny/den strojů v panelu nastavení.</p>
    </Dialog>
  );
}
