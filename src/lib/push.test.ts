import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array } from './push';

describe('urlBase64ToUint8Array', () => {
  it('decodifica un base64url sin padding a los mismos bytes que su base64 estándar equivalente', () => {
    // "hola" en base64 estándar es "aG9sYQ==" — sin padding y con -/_ en
    // vez de +/ es exactamente lo que trae una llave VAPID real.
    const resultado = urlBase64ToUint8Array('aG9sYQ');
    expect(Array.from(resultado)).toEqual([104, 111, 108, 97]); // "hola" en ASCII
  });

  it('convierte "-" y "_" (alfabeto base64url) a "+" y "/" (base64 estándar) antes de decodificar', () => {
    // Bytes que producen '+' o '/' en base64 estándar dependen del
    // contenido exacto — se arma un caso conocido en vez de adivinar:
    // Buffer [0xfb, 0xff] -> base64 estándar "+/8=" -> base64url "-_8".
    const resultado = urlBase64ToUint8Array('-_8');
    expect(Array.from(resultado)).toEqual([0xfb, 0xff]);
  });

  it('agrega el padding "=" correcto según el resto de la longitud', () => {
    // Una llave VAPID pública real (87 caracteres, resto 3 al dividir
    // entre 4) — confirma que no explota con longitudes "raras" típicas
    // de una llave real, no solo con ejemplos redondos de 4 en 4.
    const publicKeyReal = 'BDQsC69yluQ8rIcfB-40HNJSx1unUxYJJcRyMVbesak8FUHDHlHvOBJqgNkosgcSlX63F9Q0R4FjsbrmGPj9SsQ';
    const resultado = urlBase64ToUint8Array(publicKeyReal);
    // Una llave pública EC P-256 sin comprimir siempre empieza en 0x04 y
    // mide 65 bytes — si la conversión estuviera mal, esto ya fallaría.
    expect(resultado.length).toBe(65);
    expect(resultado[0]).toBe(0x04);
  });

  it('longitud ya múltiplo de 4 no agrega padding de más', () => {
    // "AAAA" son 4 caracteres -> 3 bytes, todos cero
    expect(Array.from(urlBase64ToUint8Array('AAAA'))).toEqual([0, 0, 0]);
  });
});
