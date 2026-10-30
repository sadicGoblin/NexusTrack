import { escaparHtml, formatear } from './formato.js';

describe('formato de exportación', () => {
  it('formatea según el tipo de columna', () => {
    expect(formatear(565000, 'pesos')).toBe('$565.000');
    expect(formatear('2026-10-15', 'fecha')).toBe('15/10/2026');
    expect(formatear(0.08, 'porcentaje')).toBe('8 %');
    expect(formatear(230.25, 'decimal')).toBe('230,25');
    expect(formatear(374, 'decimal')).toBe('374');
    expect(formatear(true, 'booleano')).toBe('Sí');
    expect(formatear(null, 'pesos')).toBe('');
  });

  it('escapa HTML para evitar inyección en los PDF', () => {
    expect(escaparHtml('<script>"x" & \'y\'</script>')).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });
});
