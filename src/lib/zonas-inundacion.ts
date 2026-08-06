export type RiesgoInundacion = 'alto' | 'medio' | 'bajo';

export interface DeteccionRiesgo {
  riesgo: RiesgoInundacion;
  confianza: 'confirmada' | 'probable';
}

// ─────────────────────────────────────────────────────────────────────────────
// FUENTE PRIMARIA
// Galindo-Alcantara, A., Ruiz-Acosta, S. C., Morales-Hernández, A.,
// Palomeque-de la Cruz, M. A., y Núñez-Magaña, T. G. (2023).
// Atlas de Riesgos del Municipio de Centro, 2023.
// Ayuntamiento de Centro. P 377
// Texto extraído directamente del PDF.
//
// METODOLOGÍA (Cap. 4, pp. 171–181):
//   • Modelo digital LIDAR (1 m/píxel) + batimetría GPS-RTK.
//   • Simulación hidráulica 2D con IBER (Bladé et al., 2014).
//   • Periodos de retorno: 2 / 5 / 10 / 25 / 50 / 100 / 500 años.
//   • Categorías de peligro (diagrama Dürrigo / SEDATU 2014) por tirante:
//       0 – 0.25 m  →  Muy Bajo
//       0.25 – 0.65 m  →  Bajo
//       0.65 – 0.85 m  →  Medio
//       0.85 – 1.35 m  →  Alto
//       1.35 – 2.00 m  →  Muy Alto
//   • Nuestros 3 niveles: bajo = muy bajo + bajo;  medio = medio;
//                         alto = alto + muy alto.
//
// CONTEXTO CLAVE (2023):
//   Desde la compuerta El Macayo (2013) y los muros del Malecón Carlos A.
//   Madrazo el riesgo de desbordamiento en la ciudad se redujo drásticamente.
//   El peligro predominante hoy es el ANEGAMIENTO pluvial, que depende de
//   la operación continua de cárcamos (estaciones de bombeo). Una falla
//   eléctrica o mecánica eleva de inmediato el nivel de riesgo local.
//
// ORGANIZACIÓN POR DISTRITOS (Cap. 8 y 9, pp. 231–320):
//   Dist. I   — Centro Histórico / La Venta (protegido, riesgo residual medio)
//   Dist. II  — La Venta (mismo nivel que Dist. I)
//   Dist. III — Deportiva / CICOM (zona más alta; bajo riesgo)
//   Dist. IV  — Atasta / Tamulté (anegamiento en vaso regulador)
//   Dist. V   — Tabasco 2000 / Carrizal (bien drenado; anegamiento menor)
//   Dist. VI  — Norte periférico / Valle Marino (riesgo alto, nuevas construcciones en
//               zonas de retención natural; >1 m en 2007)
//   Dist. VII — Casa Blanca / Laguna El Negro (anegamiento, riesgo alto)
//   Dist. VIII— Ciudad Industrial (industrial, pocos residentes; anegamiento medio)
//   Dist. IX  — Zona Habitacional Ciudad Industrial / Fracc. Lagunas (mixto)
//   Dist. X   — Las Gaviotas / La Manga (bordos con historial de falla; alto)
//   Dist. XI  — Reserva Sur (cuenca río Viejo Mezcalapa; riesgo medio)
//   Dist. XII — Loma de Caballo / Altamira (prácticamente nulo post-Macayo)
//
// ORDEN: más específico primero para evitar falsos positivos por substrings.
// ─────────────────────────────────────────────────────────────────────────────

const ZONAS: Array<{ patron: string[]; municipio?: string; riesgo: RiesgoInundacion }> = [

  // ══════════════════════════════════════════════════════════════════════════
  // RIESGO ALTO — colonias con historial severo o fuera del sistema de protección
  // ══════════════════════════════════════════════════════════════════════════

  // ── Las Gaviotas (Dist. X) ─────────────────────────────────────────────────
  // Bordos han fallado en 1999, 2007 y 2020. "Una de las zonas con mayor historia."
  { patron: ['gaviotas sur sector san jose', 'gaviotas sur san jose'],      riesgo: 'alto' },
  { patron: ['gaviotas sur armenia'],                                        riesgo: 'alto' },
  { patron: ['gaviotas sur'],                                                riesgo: 'alto' },
  { patron: ['gaviotas norte sector explanada', 'gaviotas norte explanada'],riesgo: 'alto' },
  { patron: ['gaviotas norte sector popular'],                               riesgo: 'alto' },
  { patron: ['gaviotas norte'],                                              riesgo: 'alto' },
  { patron: ['gaviotas'],                                                    riesgo: 'alto' }, // genérico

  // ── El Monal / El Coquito (Dist. X / zona norte Dist. VI) ─────────────────
  // Falla de bordo de contención en 2020 con inundación grave.
  { patron: ['el monal', 'monal'],                                          riesgo: 'alto' },
  { patron: ['el coquito', 'coquito'],                                       riesgo: 'alto' },

  // ── Río de la Sierra — zona sin control hidráulico suficiente ─────────────
  // "El control hidráulico no es suficiente para mantener estabilidad."
  { patron: ['ixtacomitan', 'ixtacomitanes'],                               riesgo: 'alto' },
  { patron: ['plutarco elias calles', 'plutarco elías calles'],              riesgo: 'alto' },
  { patron: ['rio viejo', 'río viejo'],                                      riesgo: 'alto' },
  { patron: ['col. sabina', 'colonia sabina', 'sabina'], municipio: 'Centro', riesgo: 'alto' },
  { patron: ['torno largo'],                                                 riesgo: 'alto' },
  { patron: ['el manguito'],                                                 riesgo: 'alto' }, // Torno Largo 3ra sección

  // ── La Manga (Dist. X, margen río De la Sierra / Carretera del Golfo) ─────
  // Zona históricamente inundable; contenida pero en área de riesgo.
  { patron: ['triunfo la manga'],                                            riesgo: 'alto' },
  { patron: ['la manga ii'],                                                 riesgo: 'alto' },
  { patron: ['la manga'],                                                    riesgo: 'alto' }, // genérico

  // ── Casa Blanca (Dist. VII, Laguna El Negro) ──────────────────────────────
  // Zona de anegamiento severo; laguna El Negro regula pero puede desbordar.
  { patron: ['casa blanca'],                      municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['fovissste casa blanca'],                                       riesgo: 'alto' },

  // ── Valle Marino / Norte del Periférico (Dist. VI) ────────────────────────
  // >1 m de agua en 2007; construido sobre zonas de retención natural del río Negro.
  { patron: ['valle marino'],                     municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['asuncion castellanos', 'asunción castellanos'],                riesgo: 'alto' },

  // ── Centro Histórico / La Venta (Dist. I–II, protegidos por muro) ─────────
  // Muro del Malecón Carlos A. Madrazo protege, pero falla = catástrofe.
  // 2020: tirante del río de La Sierra amenazó la estructura. Riesgo latente.
  { patron: ['centro'],                           municipio: 'Centro',      riesgo: 'alto' },

  // ── Pino Suárez / Tierra Colorada ─────────────────────────────────────────
  { patron: ['jose ma pino suarez', 'josé ma pino suárez', 'jose ma. pino suarez'], riesgo: 'alto' },
  { patron: ['tierra colorada'],                                             riesgo: 'alto' },

  // ── Ciudad Industrial (Dist. VIII) ────────────────────────────────────────
  // Zona con anegamiento y riesgo por asentamiento irregular en vaso inundable.
  { patron: ['ciudad industrial'],                municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['roberto madrazo pintado'],                                     riesgo: 'alto' },

  // ── Colonias con clasificación Alta confirmada ─────────────────────────────
  { patron: ['el recreo', 'recreo'],                                         riesgo: 'alto' },
  { patron: ['guayabal'],                         municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['mayito'],                           municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['curahueso', 'cura hueso'],                                     riesgo: 'alto' },
  { patron: ['fracc carrizal', 'fraccionamiento carrizal', 'fracc. carrizal'], riesgo: 'alto' },
  { patron: ['brisas del carrizal', 'brisas carrizal'],                     riesgo: 'alto' },
  { patron: ['club campestre'],                                              riesgo: 'alto' },
  { patron: ['electricistas'],                    municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['plaza villahermosa'],                                          riesgo: 'alto' },
  { patron: ['tulipanes'],                        municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['27 de febrero', 'veintisiete de febrero'],                     riesgo: 'alto' },
  { patron: ['valle verde'],                                                 riesgo: 'alto' },
  { patron: ['encanto'],                          municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['olimpo'],                           municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['las torres'],                       municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['topacio'],                          municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['saloya'],                                                      riesgo: 'alto' },
  { patron: ['bosques de saloya'],                                           riesgo: 'alto' },
  { patron: ['espejo'],                                                      riesgo: 'alto' }, // El Espejo I y II
  { patron: ['reforma agraria'],                                             riesgo: 'alto' },
  { patron: ['revolucion mexicana', 'revolución mexicana'],                  riesgo: 'alto' },
  { patron: ['francisco villa'],                  municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['guadalupe borja'],                                             riesgo: 'alto' },
  { patron: ['samarkanda'],                                                  riesgo: 'alto' }, // orilla río de la Pigua
  { patron: ['las americanas', 'las américas'],                              riesgo: 'alto' },
  { patron: ['la lima'],                          municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['boquerones'],                       municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['fovissste'],                        municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['cedral'],                           municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['arboledas'],                        municipio: 'Centro',      riesgo: 'alto' },
  { patron: ['portal del agua'],                                             riesgo: 'alto' },
  { patron: ['gracias mexico', 'gracias méxico'],                            riesgo: 'alto' },

  // ── Zonas rurales / peri-urbanas de alto riesgo (Atlas 2023, municipio Centro) ──
  { patron: ['ismate', 'chilapilla'],                                        riesgo: 'alto' },
  { patron: ['aztlan', 'aztlán'],                                            riesgo: 'alto' },
  { patron: ['barrancas y guanal'],                                          riesgo: 'alto' },
  { patron: ['coronel traconis'],                                            riesgo: 'alto' },
  { patron: ['acachapan'],                                                   riesgo: 'alto' },
  { patron: ['los patos'],                        municipio: 'Centro',      riesgo: 'alto' },

  // ══════════════════════════════════════════════════════════════════════════
  // RIESGO MEDIO — anegamiento frecuente o dependencia de bombeo / infraestructura
  // ══════════════════════════════════════════════════════════════════════════

  // ── Tamulté / Atasta general (Dist. IV) ───────────────────────────────────
  // Vaso regulador de Tamulté frecuentemente afectado. Atasta tiene zonas altas
  // pero también áreas bajas sujetas a anegamiento.
  { patron: ['tamulte de las barrancas'],                                    riesgo: 'bajo' }, // anegación pluvial solamente; nota: es diferente de "tamulte" genérico
  { patron: ['atasta de serra'],                                             riesgo: 'bajo' }, // Atlas 2023: "nulo riesgo de desbordamiento de ríos"
  { patron: ['atasta'],                                                      riesgo: 'medio' }, // genérico — zona general con variación
  { patron: ['tamulte'],                                                     riesgo: 'medio' }, // genérico — vaso regulador; diferente a Tamulté de las Barrancas

  // ── Colonias con drenaje bloqueado a Laguna Covadonga (Dist. IV) ──────────
  // El muro de la laguna Covadonga impide el drenaje natural; agua debe bombearse.
  { patron: ['estrellas de buenavista', 'estrellas buenavista'],             riesgo: 'medio' },
  { patron: ['islas del mundo'],                                             riesgo: 'medio' },
  { patron: ['santa elena'],                      municipio: 'Centro',      riesgo: 'medio' }, // drenaje bloqueado por muro Covadonga

  // ── Miguel Hidalgo / Del Bosque / zona Av. México (Dist. IV) ─────────────
  // Anegamiento en Av. México hasta 40 cm (Peligro Bajo / SEDATU). Zona conflictiva.
  { patron: ['miguel hidalgo ii', 'miguel hidalgo iii'],                     riesgo: 'medio' },
  { patron: ['invitab miguel hidalgo'],                                      riesgo: 'medio' },
  { patron: ['miguel hidalgo'],                   municipio: 'Centro',      riesgo: 'medio' },

  // ── Tabasco 2000 / Fracc. Carrizal zona sur (Dist. V) ────────────────────
  // Vaso regulador parcialmente rellenado; anegamiento posible si bombeo falla.
  { patron: ['la manga iii', 'la manga iii etapa'],                          riesgo: 'medio' },
  { patron: ['triangulo cd industrial', 'el triangulo', 'fracc triangulo'],  riesgo: 'medio' },

  // ── Reserva Sur (Dist. XI) ────────────────────────────────────────────────
  // Cuenca río Viejo Mezcalapa con "comportamiento especial" cuando río de la Sierra
  // crece. Atlas 2023: "alto potencial de impacto" en zona norte sin construir.
  // Área comercial establecida (Costco/Altabrisa/Soriana): relativamente segura.
  { patron: ['reserva sur'],                      municipio: 'Centro',      riesgo: 'medio' },

  // ── Otras colonias con nivel Medio confirmado ─────────────────────────────
  { patron: ['carlos a madrazo', 'carlos madrazo becerra', 'madrazo becerra'], riesgo: 'medio' },
  { patron: ['buena vista', 'buenavista'],                                   riesgo: 'medio' },
  { patron: ['framboyanes'],                                                 riesgo: 'medio' },
  { patron: ['indeco'],                                                      riesgo: 'medio' },
  { patron: ['las granjas'],                                                 riesgo: 'medio' },
  { patron: ['aquiles serdan', 'aquiles serdán'],                            riesgo: 'medio' },
  { patron: ['ninos heroes', 'niños héroes'],                                riesgo: 'medio' },
  { patron: ['pino suarez', 'pino suárez'],                                  riesgo: 'medio' }, // genérico — diferente a José Ma. Pino Suárez
  { patron: ['lindavista'],                                                  riesgo: 'medio' },
  { patron: ['providencia'],                      municipio: 'Centro',      riesgo: 'medio' },
  { patron: ['hidalgo'],                          municipio: 'Centro',      riesgo: 'medio' },
  { patron: ['galaxia'],                          municipio: 'Centro',      riesgo: 'medio' },

  // ── Zonas rurales de transición (Atlas 2023) ──────────────────────────────
  { patron: ['playas del rosario', 'subteniente garcia', 'subteniente garcía'], riesgo: 'medio' },
  { patron: ['ocuiltzapotlan', 'ocuiltzapotlán'],                            riesgo: 'medio' },
  { patron: ['pueblo nuevo', 'parrilla'],          municipio: 'Centro',     riesgo: 'medio' },

  // ══════════════════════════════════════════════════════════════════════════
  // RIESGO BAJO — zonas protegidas, elevadas o con historial limpio
  // ══════════════════════════════════════════════════════════════════════════

  // ── Zona más alta de la ciudad (Dist. III — Deportiva/CICOM) ─────────────
  // Atlas 2023 p. 246: "una de las zonas más altas de la ciudad."
  { patron: ['primero de mayo', '1 de mayo'],                                riesgo: 'bajo' },
  { patron: ['colonia reforma', 'col reforma'],   municipio: 'Centro',      riesgo: 'bajo' },
  { patron: ['ciudad deportiva'],                 municipio: 'Centro',      riesgo: 'bajo' }, // zona elevada, riesgo nulo

  // ── Loma de Caballo (Dist. XII) ───────────────────────────────────────────
  // Atlas 2023 p. 317: "Desde la construcción de la compuerta El Macayo,
  // la amenaza por inundaciones en el distrito es prácticamente nula."
  { patron: ['loma de caballo'],                  municipio: 'Centro',      riesgo: 'bajo' },
  { patron: ['altamira'],                         municipio: 'Centro',      riesgo: 'bajo' }, // mismo distrito que Loma de Caballo

  // ── Tabasco 2000 (Dist. V) ────────────────────────────────────────────────
  // Drenaje bien diseñado. Inundado en 1999 (evento extremo), estable desde.
  { patron: ['tabasco 2000', 'tabasco2000'],                                 riesgo: 'bajo' },

  // ── Fraccionamiento Lagunas / Zona Habitacional Cd. Industrial (Dist. IX) ─
  // Principalmente bajo excepto zona D (asentamiento irregular en vaso inundable).
  { patron: ['fracc. lagunas', 'fracc lagunas', 'fraccionamiento lagunas'],  riesgo: 'bajo' },

  // ── Carrizal zona residencial ─────────────────────────────────────────────
  // Colonia Carrizal ≠ Fracc. Carrizal (que es alto). El patrón genérico
  // captura lo que no fue tomado por los patrones más específicos de arriba.
  { patron: ['colonia carrizal'],                                            riesgo: 'bajo' },
  { patron: ['carrizal'],                                                    riesgo: 'bajo' }, // genérico

  // ── Colonias norponiente / Prados / Kehoe ────────────────────────────────
  { patron: ['nueva villahermosa'],                                          riesgo: 'bajo' }, // 44.88 ha = Muy Bajo en Atlas 2013
  { patron: ['heriberto kehoe', 'kehoe vicent'],                             riesgo: 'bajo' }, // 99% = Muy Bajo en Atlas 2013
  { patron: ['petrolera'],                        municipio: 'Centro',      riesgo: 'bajo' }, // Atlas 2013: Muy Bajo en zona residencial
  { patron: ['prados de villahermosa'],                                      riesgo: 'bajo' },
  { patron: ['diamante'],                                                    riesgo: 'bajo' },
  { patron: ['jardines del grijalva', 'jardines de grijalva'],               riesgo: 'bajo' },
  { patron: ['del bosque'],                       municipio: 'Centro',      riesgo: 'bajo' }, // anegamiento leve (tirante ~40 cm = Peligro Bajo)
  { patron: ['18 de marzo'],                      municipio: 'Centro',      riesgo: 'bajo' },
  { patron: ['blancas mariposas'],                                           riesgo: 'bajo' }, // Dist. XI, zona establecida con tratamiento de aguas
  { patron: ['las garzas'],                                                  riesgo: 'bajo' },
  { patron: ['punta brava'],                      municipio: 'Centro',      riesgo: 'bajo' },
  { patron: ['multi 80', 'multi 83', 'multi 85'],                           riesgo: 'bajo' },
  { patron: ['jardines del villahermosa', 'jardines de villahermosa'],       riesgo: 'bajo' },
  { patron: ['lomas de casa blanca'],                                        riesgo: 'bajo' },
  { patron: ['paraiso dorado', 'paraíso dorado'],                            riesgo: 'bajo' },
  { patron: ['villas del grijalva', 'villas grijalva'],                      riesgo: 'bajo' },
  { patron: ['parque tabasco'],                                              riesgo: 'bajo' },
  { patron: ['montecarlo'],                       municipio: 'Centro',      riesgo: 'bajo' },
  { patron: ['villahermosa 2000'],                                           riesgo: 'bajo' },
  { patron: ['lomas'],                            municipio: 'Centro',      riesgo: 'bajo' },

  // ── Zonas rurales elevadas (Atlas 2023) ───────────────────────────────────
  { patron: ['terraza de macuspana'],                                        riesgo: 'bajo' },
  { patron: ['terraza de reforma'],                                          riesgo: 'bajo' },
];

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectarRiesgoInundacion(
  colonia: string,
  municipio?: string,
): DeteccionRiesgo | null {
  const normColonia = normalizar(colonia);
  if (normColonia.length < 4) return null;

  for (const zona of ZONAS) {
    if (zona.municipio && municipio && zona.municipio !== municipio) continue;

    for (const patron of zona.patron) {
      const normPatron = normalizar(patron);
      if (normColonia.includes(normPatron)) {
        return {
          riesgo: zona.riesgo,
          confianza: normColonia === normPatron ? 'confirmada' : 'probable',
        };
      }
    }
  }
  return null;
}
