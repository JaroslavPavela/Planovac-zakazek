import { FAZE, STAV_POPISEK, nazevFaze } from '../../domain/types';
import type { FazeId, Nastaveni, Pripravar, RozvrhZakazky, Zakazka } from '../../domain/types';
import { Dialog } from '../Dialog';
import { formatDatum, formatHodiny, formatPracovniCas } from '../format';

interface Props {
  zakazka: Zakazka;
  rozvrh: RozvrhZakazky;
  nastaveni: Nastaveni;
  pripravari: Pripravar[];
  onZavrit: () => void;
}

export function OrderDetail({ zakazka, rozvrh, nastaveni, pripravari, onZavrit }: Props) {
  const pripravar = pripravari.find((p) => p.id === rozvrh.pripravarId);
  const hodDen = (f: FazeId) => (f === 'tpv' ? nastaveni.hodDenPripravar : nastaveni.hodDenStroj[f]);
  const popisek = (f: FazeId) => (f === 'tpv' ? 'TPV (příprava)' : f === 'kompletace' ? 'Kompletace / ohýbání' : nazevFaze(nastaveni, f));
  return (
    <Dialog titulek={`${zakazka.cislo} — ${zakazka.nazev}`} onZavrit={onZavrit} sirka={640}>
      <dl className="detail-mrizka">
        <dt>Firma</dt>
        <dd>{zakazka.firma}</dd>
        <dt>Přípravář</dt>
        <dd>{pripravar?.nazev ?? 'v zásobníku'}</dd>
        <dt>Termín zadání</dt>
        <dd>{formatDatum(zakazka.terminZadani)}</dd>
        <dt>Termín dokončení</dt>
        <dd>{formatDatum(zakazka.terminDokonceni)}</dd>
        <dt>Stav</dt>
        <dd>
          <span className={`stitek stitek-stav stav-${rozvrh.stav}`}>{STAV_POPISEK[rozvrh.stav]}</span>
          {rozvrh.nestihnutelne && <span className="stitek stitek-nestihnutelne">nestihnutelné</span>}
        </dd>
        <dt>Předpokládané dokončení</dt>
        <dd>{rozvrh.predpokladaneDokonceni ? formatDatum(rozvrh.predpokladaneDokonceni.den) : '—'}</dd>
        <dt>Nejpozdější start TPV</dt>
        <dd>{formatDatum(rozvrh.nejpozdejsiStartTpv)}</dd>
      </dl>
      <table className="tabulka-fazi">
        <thead>
          <tr>
            <th>Fáze</th>
            <th>Hodiny</th>
            <th>Hodin/den</th>
            <th>Připraveno</th>
            <th>Start</th>
            <th>Konec</th>
          </tr>
        </thead>
        <tbody>
          {FAZE.map((f) => {
            const hodiny = f === 'tpv' ? zakazka.tpvHod : f === 'kompletace' ? zakazka.kompletaceHod : zakazka[`${f}Hod`];
            const r = rozvrh.faze[f];
            return (
              <tr key={f} className={hodiny > 0 ? '' : 'radek-tichy'}>
                <td>{popisek(f)}</td>
                <td>{formatHodiny(hodiny)}</td>
                <td>{formatHodiny(hodDen(f))}</td>
                <td>{r?.pripraveno ? formatPracovniCas(r.pripraveno, hodDen(f), 'd. M. yyyy') : '—'}</td>
                <td>{r ? formatPracovniCas(r.start, hodDen(f), 'd. M. yyyy') : hodiny > 0 ? 'nepřiřazeno' : '—'}</td>
                <td>{r ? formatPracovniCas(r.konec, hodDen(f), 'd. M. yyyy') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Dialog>
  );
}
