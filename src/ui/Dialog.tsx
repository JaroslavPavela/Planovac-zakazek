import type { ReactNode } from 'react';

interface DialogProps {
  titulek: string;
  onZavrit: () => void;
  children: ReactNode;
  akce?: ReactNode;
  sirka?: number;
}

/** Jednoduchý modální dialog (místo nativních alert/confirm). */
export function Dialog({ titulek, onZavrit, children, akce, sirka = 560 }: DialogProps) {
  return (
    <div className="dialog-pozadi" onClick={onZavrit} role="presentation">
      <div className="dialog" style={{ width: sirka }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulek}>
        <header className="dialog-hlavicka">
          <h2>{titulek}</h2>
          <button type="button" className="tlacitko-ikona" onClick={onZavrit} aria-label="Zavřít">
            ×
          </button>
        </header>
        <div className="dialog-obsah">{children}</div>
        {akce && <footer className="dialog-akce">{akce}</footer>}
      </div>
    </div>
  );
}

interface PotvrzeniProps {
  titulek: string;
  text: string;
  potvrdit: string;
  nebezpecne?: boolean;
  onPotvrdit: () => void;
  onZrusit: () => void;
}

export function Potvrzeni({ titulek, text, potvrdit, nebezpecne, onPotvrdit, onZrusit }: PotvrzeniProps) {
  return (
    <Dialog
      titulek={titulek}
      onZavrit={onZrusit}
      sirka={440}
      akce={
        <>
          <button type="button" onClick={onZrusit}>
            Zrušit
          </button>
          <button type="button" className={nebezpecne ? 'tlacitko-nebezpecne' : 'tlacitko-primarni'} onClick={onPotvrdit} autoFocus>
            {potvrdit}
          </button>
        </>
      }
    >
      <p>{text}</p>
    </Dialog>
  );
}
