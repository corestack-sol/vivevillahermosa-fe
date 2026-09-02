import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backendApi';

// Debe coincidir con el límite real del backend y con la misma constante
// duplicada en PublishForm.tsx/OwnerActionsBar.tsx/
// dashboard/propiedades/page.tsx — el servidor es quien de verdad lo hace
// cumplir (código LIMITE_PROPIEDADES_ALCANZADO).
export const LIMITE_PROPIEDADES = 3;

// Cambio de política confirmado en vivo 2026-09-02
// (docs/BACKEND-LIMITE-PROPIEDADES-02092026.md): el backend ahora cuenta
// activas Y pausadas juntas contra el límite — pausar una propiedad ya NO
// libera espacio, solo eliminarla. Antes de este cambio, contar solo
// 'activa' aquí hubiera dejado publicar/reactivar cosas que el backend
// iba a rechazar igual (el chequeo real es el del servidor, este es solo
// para no mandar a alguien a un formulario de 6 pasos para nada).
export const ESTADOS_QUE_CUENTAN_PARA_LIMITE = ['activa', 'pausada'] as const;

export const MENSAJE_LIMITE_PROPIEDADES =
  `Ya tienes ${LIMITE_PROPIEDADES} propiedades (activas o pausadas) — el máximo gratuito. Elimina alguna para publicar una nueva.`;

/**
 * Pre-chequeo del límite gratuito de propiedades activas — pensado para
 * atenuar el botón "Publicar" ANTES de que la persona entre al formulario
 * de 6 pasos y lo llene completo solo para toparse con el gate hasta el
 * final (reporte real 2026-09-01: "no debe permitir que llene un
 * formulario cuando de antemano no podrá publicar"). PublishForm.tsx sigue
 * teniendo su propio chequeo — este hook no lo reemplaza, evita el viaje
 * redundante para quien ya sabe que está topado.
 *
 * `activo` en `false` evita la llamada cuando no hace falta (sin sesión,
 * cuenta profesional sin este límite, etc.) — mismo patrón que
 * `usePerfilInmobiliaria(activo)`.
 */
export function useLimitePropiedades(activo: boolean): boolean {
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    backendFetch<{ propiedades: { estado: string }[] }>('/propiedades/mias')
      .then(({ propiedades }) => {
        if (cancelado) return;
        const vivas = propiedades.filter((p) =>
          (ESTADOS_QUE_CUENTAN_PARA_LIMITE as readonly string[]).includes(p.estado),
        ).length;
        setLimiteAlcanzado(vivas >= LIMITE_PROPIEDADES);
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [activo]);

  return activo && limiteAlcanzado;
}
