// Vygeneruje vzor/zakazky-vzor.xlsx — vzorový vstupní soubor podle sekce 2.6 specifikace.
// Spuštění: npm run vzor

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { isoNaExcelSerial } from '../src/import/excelDatum';
import { NAZVY_SLOUPCU, POVINNE_SLOUPCE } from '../src/import/headers';

const koren = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cilovySoubor = resolve(koren, 'vzor', 'zakazky-vzor.xlsx');

// [číslo, název, firma, TPV, F1, F2, V, K, zadání, dokončení]
const ZAKAZKY: [string, string, string, number, number, number, number, number, string, string][] = [
  ['Z-2026-101', 'Fasádní kazety — severní průčelí', 'Stavby Novák s.r.o.', 12, 16, 0, 8, 8, '2026-10-12', '2026-10-23'],
  ['Z-2026-102', 'Obklad atiky, 48 bm', 'Metalfas a.s.', 6, 0, 8, 0, 4, '2026-10-12', '2026-10-21'],
  ['Z-2026-103', 'Lemování oken, 36 ks', 'Okna Plus s.r.o.', 4, 0, 0, 6, 6, '2026-10-13', '2026-10-27'],
  ['Z-2026-104', 'Oplechování střechy haly B', 'Průmyslové stavby Brno', 16, 12, 12, 0, 16, '2026-10-14', '2026-11-06'],
  ['Z-2026-105', 'Parapety vnější, 120 ks', 'Okna Plus s.r.o.', 3, 0, 0, 4, 2, '2026-10-14', '2026-10-20'],
  ['Z-2026-106', 'Fasádní kazety — vstupní portál', 'Stavby Novák s.r.o.', 10, 10, 0, 6, 6, '2026-10-15', '2026-11-03'],
  ['Z-2026-107', 'Žaluziové lamely, 2 sestavy', 'Architekti Dvořák', 20, 0, 24, 0, 12, '2026-10-19', '2026-10-27'],
  ['Z-2026-108', 'Krycí plechy rozvaděčů', 'Elektro Svoboda', 2, 0, 0, 3, 1, '2026-10-19', '2026-10-23'],
  ['Z-2026-109', 'Obklad sloupů, perforovaný plech', 'Metalfas a.s.', 8, 0, 0, 16, 8, '2026-10-20', '2026-11-10'],
  ['Z-2026-110', 'Lemování atiky a dilatací', 'Průmyslové stavby Brno', 5, 4, 0, 0, 4, '2026-10-21', '2026-10-30'],
  ['Z-2026-111', 'Fasádní kazety — jižní průčelí', 'Stavby Novák s.r.o.', 14, 18, 0, 10, 10, '2026-10-26', '2026-11-02'],
  ['Z-2026-112', 'Větrací mřížky, 60 ks', 'Elektro Svoboda', 3, 0, 0, 5, 2, '2026-10-27', '2026-11-04'],
];

const hlavicka = POVINNE_SLOUPCE.map((k) => NAZVY_SLOUPCU[k]);
const radky: (string | number | XLSX.CellObject)[][] = [
  hlavicka,
  ...ZAKAZKY.map((z) => [
    ...z.slice(0, 8),
    { t: 'n', v: isoNaExcelSerial(z[8]), z: 'd.m.yyyy' } as XLSX.CellObject,
    { t: 'n', v: isoNaExcelSerial(z[9]), z: 'd.m.yyyy' } as XLSX.CellObject,
  ]),
];

const list = XLSX.utils.aoa_to_sheet(radky);
list['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 26 }, ...Array(5).fill({ wch: 14 }), { wch: 16 }, { wch: 18 }];
const sesit = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(sesit, list, 'Zakázky');

mkdirSync(dirname(cilovySoubor), { recursive: true });
const data = XLSX.write(sesit, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
writeFileSync(cilovySoubor, data);
console.log(`Vytvořen ${cilovySoubor} (${ZAKAZKY.length} zakázek).`);
