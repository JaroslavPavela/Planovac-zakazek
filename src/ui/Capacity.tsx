// Vytížení: tabulka přípravář × ISO týden — přidělené h / dostupné h (%), podbarvení podle podílu,
// řádek součtu. Dostupné hodiny zohledňují svátky (méně pracovních dnů v týdnu).

import { dostupneHodinyVTydnu } from '../domain/scheduler';
import type { Rozvrh } from '../domain/types';
import { usePlanStore } from '../store/planStore';
import { formatDatum, formatHodiny, formatProcenta } from './format';
import type { Osa } from './Gantt/lanes';

function tridaPodilu(pridelene: number, dostupne: number): string {
  if (pridelene <= 0) return 'vytizeni-nic';
  const podil = dostupne > 0 ? pridelene / dostupne : Infinity;
  if (podil < 0.8) return 'vytizeni-ok';
  if (podil <= 1) return 'vytizeni-plne';
  return 'vytizeni-pretizeno';
}

function Bunka({ pridelene, dostupne }: { pridelene: number; dostupne: number }) {
  const podil = dostupne > 0 ? pridelene / dostupne : pridelene > 0 ? Infinity : 0;
  return (
    <td className={`vytizeni-bunka ${tridaPodilu(pridelene, dostupne)}`}>
      <span className="vytizeni-hodiny">
        {formatHodiny(pridelene)} / {formatHodiny(dostupne)} h
      </span>
      <span className="vytizeni-procenta">{Number.isFinite(podil) ? formatProcenta(podil) : '—'}</span>
    </td>
  );
}

export function Capacity({ rozvrh, osa }: { rozvrh: Rozvrh; osa: Osa }) {
  const pripravari = usePlanStore((s) => s.pripravari);
  const nastaveni = usePlanStore((s) => s.nastaveni);

  // Týdny z osy Ganttu + případné další, ve kterých je něco přiděleno (mimo horizont by být neměly).
  const tydny = osa.tydny.map((t) => t.tyden);
  for (const perTyden of Object.values(rozvrh.vytizeni)) {
    for (const t of Object.keys(perTyden)) if (!tydny.includes(t)) tydny.push(t);
  }
  tydny.sort();
  const dostupne = Object.fromEntries(tydny.map((t) => [t, dostupneHodinyVTydnu(t, nastaveni.hodDenPripravar)]));
  const soucty = Object.fromEntries(tydny.map((t) => [t, pripravari.reduce((s, p) => s + (rozvrh.vytizeni[p.id]?.[t] ?? 0), 0)]));

  return (
    <section className="vytizeni">
      <table className="tabulka-vytizeni">
        <thead>
          <tr>
            <th>Přípravář</th>
            {osa.tydny.map((t) => (
              <th key={t.tyden}>
                <div>{t.tyden.replace('-W', ' / T')}</div>
                <div className="vytizeni-od">od {formatDatum(t.od, 'd. M.')}</div>
              </th>
            ))}
            {tydny
              .filter((t) => !osa.tydny.some((o) => o.tyden === t))
              .map((t) => (
                <th key={t}>{t.replace('-W', ' / T')}</th>
              ))}
          </tr>
        </thead>
        <tbody>
          {pripravari.map((p) => (
            <tr key={p.id}>
              <th>{p.nazev}</th>
              {tydny.map((t) => (
                <Bunka key={t} pridelene={rozvrh.vytizeni[p.id]?.[t] ?? 0} dostupne={dostupne[t]} />
              ))}
            </tr>
          ))}
          <tr className="vytizeni-soucet">
            <th>Celkem</th>
            {tydny.map((t) => (
              <Bunka key={t} pridelene={soucty[t]} dostupne={dostupne[t] * pripravari.length} />
            ))}
          </tr>
        </tbody>
      </table>
      <p className="napoveda">
        Přidělené hodiny TPV / dostupné hodiny (pracovní dny v týdnu × {formatHodiny(nastaveni.hodDenPripravar)} h). Zelená &lt; 80 %, oranžová 80–100 %, červená &gt; 100 %.
      </p>
    </section>
  );
}
