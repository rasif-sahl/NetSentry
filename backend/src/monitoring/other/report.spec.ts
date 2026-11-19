import { csvCell } from '../report.service';
describe('CSV export', () => {
  it('quotes fields and neutralizes spreadsheet formulas', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('a"b,c')).toBe('"a""b,c"');
    expect(csvCell(null)).toBe('""');
  });
});
