import { z } from 'zod';

/**
 * Directorio de servicios (plomería, pintura, mudanza, etc.) — vertical
 * nueva, exploratoria, no conectada a la navegación principal todavía (ver
 * docs/BACKEND.md). Mismo patrón de validación que
 * publishSchema.ts (propiedades), no un estilo nuevo.
 */
export const CATEGORIA_SERVICIO_OPTIONS = [
  { value: 'plomeria', label: 'Plomería' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'mudanza', label: 'Mudanza' },
  { value: 'remodelacion', label: 'Remodelación' },
  { value: 'albanileria', label: 'Albañilería' },
  { value: 'electricidad', label: 'Electricidad' },
  { value: 'jardineria', label: 'Jardinería' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'carpinteria', label: 'Carpintería' },
  { value: 'cerrajeria', label: 'Cerrajería' },
  { value: 'fumigacion', label: 'Fumigación' },
  { value: 'aire_acondicionado', label: 'Aire acondicionado' },
] as const;

export const CATEGORIAS_SERVICIO_VALIDAS = CATEGORIA_SERVICIO_OPTIONS.map((c) => c.value);

export function categoriaServicioLabel(value: string): string {
  return CATEGORIA_SERVICIO_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

export const publishServicioSchema = z.object({
  categoria: z.enum(CATEGORIAS_SERVICIO_VALIDAS as unknown as [string, ...string[]], {
    error: 'Elige una categoría de servicio',
  }),
  nombre: z.string().min(2, 'Escribe tu nombre o el de tu negocio'),
  descripcion: z.string().min(20, 'Cuenta un poco más de tu servicio (mín. 20 caracteres)').max(1000),
  municipio: z.string().min(1, 'Selecciona el municipio donde ofreces el servicio'),
  colonia: z.string().max(150).optional(),
  telefono: z.string().refine(
    (v) => /^\d{10}$/.test(v.replace(/\s+/g, '')),
    'Ingresa tu número a 10 dígitos, sin espacios ni +52 (ej: 993 123 4567)'
  ),
  email: z.string().email('Ese correo no parece válido').optional().or(z.literal('')),
});

export type PublishServicioFormData = z.infer<typeof publishServicioSchema>;

// Entradas del portafolio ("mi trabajo") — foto de un trabajo realizado con
// una historia/descripción opcional (hay proveedores independientes que
// solo quieren mostrar la foto). El límite de 700 caracteres coincide con
// el tamaño de un párrafo corto tipo blog, no un formulario largo.
export const MAX_TRABAJO_IMAGEN_LENGTH = 1_800_000;
// Tope de entradas por proveedor — el portafolio se piensa como algo que se
// llena poco a poco, no ilimitado: sin esto, cada entrada pesa hasta 1.8MB
// en SQLite y no hay paginación en la ficha pública, así que una cuenta sin
// límite podría inflar tanto la base de datos como el peso de su propia
// página para cualquiera que la visite.
export const MAX_TRABAJOS_POR_SERVICIO = 24;

export const trabajoServicioSchema = z.object({
  imagenDataUrl: z.string()
    .min(1, 'Elige una foto del trabajo')
    .max(MAX_TRABAJO_IMAGEN_LENGTH, 'La imagen es demasiado grande')
    .refine((v) => /^data:image\/(png|jpe?g|webp);base64,.+/.test(v), 'Formato de imagen inválido — usa PNG, JPG o WebP'),
  descripcion: z.string().max(700, 'Máximo 700 caracteres').optional().or(z.literal('')),
});

export type TrabajoServicioFormData = z.infer<typeof trabajoServicioSchema>;
