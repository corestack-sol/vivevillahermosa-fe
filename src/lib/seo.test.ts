import { describe, it, expect } from 'vitest';
import { safeJsonLdString } from './seo';

describe('safeJsonLdString', () => {
  it('produces valid parseable JSON for normal data', () => {
    const data = { titulo: 'Casa en venta', precio: 100 };
    expect(JSON.parse(safeJsonLdString(data).replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))).toEqual(data);
  });

  it('escapes < and > so a </script> sequence cannot close the surrounding <script> tag', () => {
    // Real XSS vector: a property titulo containing "</script><script>alert(1)</script>"
    // injected via dangerouslySetInnerHTML in a JSON-LD block.
    const malicious = { titulo: '</script><script>alert(1)</script>' };
    const result = safeJsonLdString(malicious);
    expect(result).not.toContain('</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('\\u003c/script\\u003e');
  });

  it('escapes a bare ampersand (prevents entity-based bypass tricks)', () => {
    const data = { titulo: 'Casa & Jardín' };
    const result = safeJsonLdString(data);
    expect(result).not.toContain('&');
    expect(result).toContain('\\u0026');
  });

  it('still round-trips correctly after unescaping (the escaping is reversible / valid JSON)', () => {
    const data = { titulo: 'A < B > C & D' };
    const escaped = safeJsonLdString(data);
    const unescaped = escaped.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&');
    expect(JSON.parse(unescaped)).toEqual(data);
  });

  it('handles nested objects/arrays, not just flat top-level strings', () => {
    const data = { images: ['</script>a.jpg', '</script>b.jpg'], nested: { x: '<img onerror=alert(1)>' } };
    const result = safeJsonLdString(data);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('</script>');
  });
});
