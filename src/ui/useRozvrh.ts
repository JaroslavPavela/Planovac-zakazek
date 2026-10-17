import { useMemo } from 'react';
import { naplanuj } from '../domain/scheduler';
import type { Rozvrh } from '../domain/types';
import { usePlanStore } from '../store/planStore';

/** Rozvrh se nikdy neukládá — přepočítá se při každé změně stavu. */
export function useRozvrh(): Rozvrh {
  const zakazky = usePlanStore((s) => s.zakazky);
  const pripravari = usePlanStore((s) => s.pripravari);
  const prirazeni = usePlanStore((s) => s.prirazeni);
  const nastaveni = usePlanStore((s) => s.nastaveni);
  const poradiFaze = usePlanStore((s) => s.poradiFaze);
  return useMemo(
    () => naplanuj({ zakazky, pripravari, prirazeni, nastaveni, poradiFaze }),
    [zakazky, pripravari, prirazeni, nastaveni, poradiFaze],
  );
}
