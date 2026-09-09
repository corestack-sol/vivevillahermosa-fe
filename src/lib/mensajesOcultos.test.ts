// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getMensajesOcultos, ocultarMensaje } from './mensajesOcultos';

describe('mensajesOcultos', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty for a conversation with nothing hidden', () => {
    expect(getMensajesOcultos('conv-1')).toEqual(new Set());
  });

  it('hides a message and it persists', () => {
    ocultarMensaje('conv-1', 'msg-1');
    expect(getMensajesOcultos('conv-1')).toEqual(new Set(['msg-1']));
  });

  it('accumulates multiple hidden messages in the same conversation', () => {
    ocultarMensaje('conv-1', 'msg-1');
    ocultarMensaje('conv-1', 'msg-2');
    expect(getMensajesOcultos('conv-1')).toEqual(new Set(['msg-1', 'msg-2']));
  });

  it('scopes hidden messages per conversation — does not leak across conversations', () => {
    ocultarMensaje('conv-1', 'msg-1');
    ocultarMensaje('conv-2', 'msg-2');
    expect(getMensajesOcultos('conv-1')).toEqual(new Set(['msg-1']));
    expect(getMensajesOcultos('conv-2')).toEqual(new Set(['msg-2']));
  });

  it('is idempotent — hiding the same message twice does not duplicate it', () => {
    ocultarMensaje('conv-1', 'msg-1');
    ocultarMensaje('conv-1', 'msg-1');
    expect(getMensajesOcultos('conv-1')).toEqual(new Set(['msg-1']));
  });
});
