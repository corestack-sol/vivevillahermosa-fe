/**
 * Detector heurístico de lenguaje potencialmente discriminatorio en
 * descripciones de anuncios. Es una revisión suave del lado del cliente —
 * no bloquea la publicación, solo advierte, porque un falso positivo no
 * debe impedirle a nadie publicar.
 *
 * ⚠️ BACKEND PENDIENTE (Fase 2): esta validación corre solo en el navegador
 * y es trivialmente evitable (cualquiera puede desactivar JS o llamar a la
 * API directamente). Antes de que exista `POST /api/propiedades` en Fase 2,
 * esta misma lista — o una real basada en un modelo de lenguaje — debe
 * ejecutarse también en el servidor al recibir la publicación, para que la
 * moderación no dependa únicamente del frontend. Ver Módulo 1 y Módulo 11
 * de fase2-spec.md (persistencia + moderación).
 */

const DIACRITICOS_REGEX = /[̀-ͯ]/g;

const FRASES_SENSIBLES: string[] = [
  'no se aceptan indígenas',
  'no indígenas',
  'no extranjeros',
  'solo mexicanos',
  'no homosexuales',
  'no gays',
  'no lgbt',
  'no personas con discapacidad',
  'no discapacitados',
  'no personas con vih',
  'sin niños',
  'no niños',
  'no aceptan niños',
  'no children',
  'solo adultos',
  'únicamente adultos',
  'solo parejas sin hijos',
  'no personas de la tercera edad',
  'no adultos mayores',
  'raza blanca',
  'buena presencia',
];

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS_REGEX, '');
}

export function detectarLenguajeSensible(texto: string): string[] {
  const normalizado = normalizar(texto);
  return FRASES_SENSIBLES.filter((frase) => normalizado.includes(normalizar(frase)));
}
