// Stav zakázky (5.2) a nejpozdější start TPV (5.3).

import { odectiHodiny, posunPracovniDny, min } from './calendar';
import { STROJE, hodinyFaze } from './types';
import type { Nastaveni, PracovniCas, Stav, Zakazka } from './types';

/**
 * Stav podle dne dokončení vs. termín. Dokončení v den termínu (kdykoli během dne) = stihnuto.
 * `ohrozeno` = dokončení po (termín − rezervaDny pracovních dnů), ale ne po termínu.
 */
export function urciStav(
  dokonceni: PracovniCas | undefined,
  terminDokonceni: string,
  rezervaDny: number,
): Stav {
  if (!dokonceni) return 'neprirazeno';
  if (dokonceni.den > terminDokonceni) return 'pozde';
  const hranice = posunPracovniDny(terminDokonceni, -Math.max(0, rezervaDny));
  if (dokonceni.den > hranice) return 'ohrozeno';
  return 'ok';
}

export interface NejpozdejsiStart {
  nejpozdejsiStartTpv: string;
  nestihnutelne: boolean;
}

/**
 * Zpětný výpočet od konce dne termínu dokončení: kompletace → nejdelší stroj → TPV.
 * `nestihnutelne` = nejpozdější start je před max(začátek plánu, termín zadání).
 */
export function nejpozdejsiStart(zakazka: Zakazka, nastaveni: Nastaveni): NejpozdejsiStart {
  const konec: PracovniCas = { den: zakazka.terminDokonceni, zlomek: 1 };
  const konecStroju = odectiHodiny(konec, zakazka.kompletaceHod, nastaveni.hodDenStroj.kompletace);

  let konecTpv = konecStroju;
  for (const stroj of STROJE) {
    const hod = hodinyFaze(zakazka, stroj);
    if (hod > 0) {
      konecTpv = min(konecTpv, odectiHodiny(konecStroju, hod, nastaveni.hodDenStroj[stroj]));
    }
  }

  const startTpv = odectiHodiny(konecTpv, zakazka.tpvHod, nastaveni.hodDenPripravar);
  const nejdrivejsiMozny =
    zakazka.terminZadani > nastaveni.zacatekPlanu ? zakazka.terminZadani : nastaveni.zacatekPlanu;
  return {
    nejpozdejsiStartTpv: startTpv.den,
    nestihnutelne: startTpv.den < nejdrivejsiMozny,
  };
}
