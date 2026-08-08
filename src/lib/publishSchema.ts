import { z } from 'zod';

/**
 * Extraído de PublishForm.tsx para que también lo usen la página de Editar
 * propiedad y la carga masiva por CSV — las tres necesitan exactamente las
 * mismas reglas de validación, y antes solo vivían dentro del wizard de
 * publicar.
 */
const num = (msg: string) => z.number({ error: msg });
// Mismo motivo que `num()`: `.min(N, msg)` solo cubre "es texto pero
// demasiado corto" — si el valor ni siquiera es texto (ej. `null`, caso
// real confirmado en "operacion": un grupo de radios sin `defaultValues`
// explícito empieza en `null`, no en `''`), Zod usa su propio mensaje
// genérico ("Invalid input: expected string, received null") en vez de
// cualquier mensaje que se le haya dado solo a `.min()`. `str(msg)` le da
// un mensaje amigable también a ese primer chequeo de tipo.
const str = (msg: string) => z.string({ error: msg });

export const METODO_CONTACTO_OPTIONS = [
  { value: 'telefono', label: 'Teléfono' },
  { value: 'correo', label: 'Correo' },
  { value: 'ambos', label: 'Ambos' },
] as const;

const baseSchema = z.object({
  tipo:          str('Elige el tipo de propiedad antes de continuar').min(1, 'Elige el tipo de propiedad antes de continuar'),
  operacion:     str('Indica si es venta o renta').min(1, 'Indica si es venta o renta'),
  precio:        num('Escribe el precio de la propiedad').positive('El precio debe ser mayor a $0'),
  m2Construidos: num('Metros cuadrados inválidos').min(0).optional(),
  m2Terreno:     num('Metros de terreno inválidos').min(0).optional(),
  recamaras:     num('Número de recámaras inválido').min(0).optional(),
  banos:         num('Número de baños inválido').min(0).optional(),
  municipio:     str('Selecciona el municipio donde está la propiedad').min(1, 'Selecciona el municipio donde está la propiedad'),
  colonia:       str('Escribe el nombre de la colonia o fraccionamiento').min(2, 'Escribe el nombre de la colonia o fraccionamiento'),
  titulo:        str('Escribe un título para tu anuncio').min(10, 'El título está muy corto — sé más descriptivo (mín. 10 caracteres)'),
  descripcion:   str('Escribe una descripción para tu anuncio').min(30, 'La descripción está muy corta — añade más detalles (mín. 30 caracteres)'),
  riesgoInundacion: z.enum(['alto', 'medio', 'bajo'], { error: 'Selecciona el nivel de riesgo de inundación de la zona' }),
  nombreContacto:   str('Escribe tu nombre completo para que puedan contactarte').min(2, 'Escribe tu nombre completo para que puedan contactarte'),
  // Quien publica elige cómo quiere que le escriban — por si no quiere
  // revelar su celular a desconocidos. telefonoContacto/emailContacto se
  // validan condicionalmente abajo según esta elección, no aquí. Igual
  // llevan `str()` en vez de un `z.string()` pelón: siguen aceptando
  // `undefined` (son opcionales), pero si por lo que sea llegan como
  // `null` en vez de eso, ya no muestran el mensaje genérico de Zod.
  metodoContacto:   z.enum(['telefono', 'correo', 'ambos'], { error: 'Elige cómo quieres que te contacten' }),
  telefonoContacto: str('Escribe tu número de teléfono').optional(),
  emailContacto:    str('Escribe tu correo electrónico').optional(),
  // Por defecto false: el contacto es instantáneo con sesión iniciada. Ver
  // Property.requiereMensajePrimero en src/types/property.ts.
  requiereMensajePrimero: z.boolean().optional(),
  aceptaTerminos:   z.boolean().refine((v) => v === true, 'Debes aceptar los Términos y Condiciones para publicar'),
});

export const publishSchema = baseSchema.superRefine((data, ctx) => {
  const tel = data.telefonoContacto?.trim() ?? '';
  const email = data.emailContacto?.trim() ?? '';
  const necesitaTel = data.metodoContacto !== 'correo';
  const necesitaEmail = data.metodoContacto !== 'telefono';

  if (necesitaTel) {
    if (!tel) {
      ctx.addIssue({ code: 'custom', path: ['telefonoContacto'], message: 'Escribe tu número de teléfono' });
    } else if (!/^\d{10}$/.test(tel.replace(/\s+/g, ''))) {
      ctx.addIssue({ code: 'custom', path: ['telefonoContacto'], message: 'Ingresa tu número a 10 dígitos, sin espacios ni +52 (ej: 993 123 4567)' });
    }
  }
  if (necesitaEmail) {
    if (!email) {
      ctx.addIssue({ code: 'custom', path: ['emailContacto'], message: 'Escribe tu correo electrónico' });
    } else if (!z.string().email().safeParse(email).success) {
      ctx.addIssue({ code: 'custom', path: ['emailContacto'], message: 'Ese correo no parece válido — revisa que no tenga errores de tipeo' });
    }
  }
});

export type PublishFormData = z.infer<typeof publishSchema>;
export type MetodoContacto = PublishFormData['metodoContacto'];

/**
 * Construye el sub-objeto de contacto de un `Property.agente` respetando la
 * elección de `metodoContacto` — usado por PublishForm, Editar propiedad e
 * Importar CSV, las tres formas de crear/editar el contacto de una
 * propiedad. Omite (no vacía) el campo que la persona decidió no revelar,
 * en vez de guardarlo como string vacío.
 */
export function construirAgenteContacto(nombre: string, metodoContacto: MetodoContacto, telefono?: string, email?: string) {
  const necesitaTel = metodoContacto !== 'correo';
  const necesitaEmail = metodoContacto !== 'telefono';
  return {
    nombre,
    ...(necesitaTel && telefono ? { tel: telefono, whatsapp: telefono } : {}),
    ...(necesitaEmail && email ? { email } : {}),
  };
}

export const TIPO_OPTIONS = [
  { value: 'casa', label: 'Casa' },
  { value: 'departamento', label: 'Departamento' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'local', label: 'Local comercial' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'bodega', label: 'Bodega' },
  { value: 'habitacion', label: 'Habitación / Roomie' },
];

// Los 17 municipios de Tabasco — única fuente de verdad para todo lo que
// necesite la lista completa (publicar, editar, filtro de búsqueda,
// alertas, validación de IA vía MUNICIPIOS_VALIDOS en ai.ts/
// coloniaDiscovery.ts). Antes había 3 copias divergentes de esta lista
// (aquí, FilterPanel.tsx, alertas/page.tsx) con 10/8/6 municipios cada
// una — nadie podía publicar ni buscar en los 7 que faltaban en todas.
export const MUNICIPIO_OPTIONS = [
  { value: 'Centro', label: 'Villahermosa (Centro)' },
  { value: 'Cárdenas', label: 'Cárdenas' },
  { value: 'Comalcalco', label: 'Comalcalco' },
  { value: 'Paraíso', label: 'Paraíso / Dos Bocas' },
  { value: 'Nacajuca', label: 'Nacajuca' },
  { value: 'Jalpa de Méndez', label: 'Jalpa de Méndez' },
  { value: 'Huimanguillo', label: 'Huimanguillo' },
  { value: 'Centla', label: 'Centla' },
  { value: 'Macuspana', label: 'Macuspana' },
  { value: 'Tenosique', label: 'Tenosique' },
  { value: 'Cunduacán', label: 'Cunduacán' },
  { value: 'Emiliano Zapata', label: 'Emiliano Zapata' },
  { value: 'Balancán', label: 'Balancán' },
  { value: 'Jonuta', label: 'Jonuta' },
  { value: 'Tacotalpa', label: 'Tacotalpa' },
  { value: 'Teapa', label: 'Teapa' },
  { value: 'Jalapa', label: 'Jalapa' },
];

export const MUNICIPIO_CENTERS: Record<string, [number, number]> = {
  'Centro':          [17.9869, -92.9303],
  'Cárdenas':        [18.0037, -93.3737],
  'Comalcalco':      [18.2766, -93.2145],
  'Paraíso':         [18.3999, -93.2073],
  'Nacajuca':        [17.9936, -93.0716],
  'Jalpa de Méndez': [18.1762, -93.0656],
  'Huimanguillo':    [17.8355, -93.3826],
  'Centla':          [18.3892, -92.5917],
  'Macuspana':       [17.7633, -92.5936],
  'Tenosique':       [17.4743, -91.4241],
  'Cunduacán':       [18.0781, -93.1647],
  'Emiliano Zapata': [17.7492, -91.7695],
  'Balancán':        [17.8000, -91.5000],
  'Jonuta':          [18.0839, -92.1292],
  'Tacotalpa':       [17.5972, -92.8189],
  'Teapa':           [17.5428, -92.9558],
  'Jalapa':          [17.7000, -92.8000],
};
