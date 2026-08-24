import { describe, it, expect } from 'vitest';
import { BackendApiError } from './backendApi';

describe('BackendApiError message extraction', () => {
  it('uses the message string directly for a single-field validation error', () => {
    const err = new BackendApiError(400, { message: 'El correo no es válido' });
    expect(err.message).toBe('El correo no es válido');
  });

  it('joins an array of messages with ". " (NestJS ValidationPipe multi-field error)', () => {
    // Real bug fixed this session: NestJS sends `message` as an ARRAY when
    // several fields are invalid at once — String(array) silently used JS's
    // implicit join (commas, no spaces), unreadable.
    const err = new BackendApiError(400, {
      message: ['el correo debe ser válido', 'la contraseña es muy corta'],
    });
    expect(err.message).toBe('el correo debe ser válido. la contraseña es muy corta');
  });

  it('falls back to a generic "Backend respondió N" when the body has no message field', () => {
    const err = new BackendApiError(500, { error: 'Internal Server Error' });
    expect(err.message).toBe('Backend respondió 500');
  });

  it('falls back to the generic message when the body is null/not an object', () => {
    expect(new BackendApiError(503, null).message).toBe('Backend respondió 503');
    expect(new BackendApiError(503, 'plain string body').message).toBe('Backend respondió 503');
  });

  it('exposes status and body for callers that need to branch on error codes', () => {
    const err = new BackendApiError(429, { code: 'LIMITE_PROPIEDADES_ALCANZADO' });
    expect(err.status).toBe(429);
    expect(err.body).toEqual({ code: 'LIMITE_PROPIEDADES_ALCANZADO' });
  });
});
