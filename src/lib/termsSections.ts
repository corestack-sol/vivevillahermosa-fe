// Contenido de los Términos y Condiciones — separado de TermsModal.tsx
// (que es 'use client') porque un Server Component (src/app/terminos/page.tsx)
// no puede importar un export plano de un módulo 'use client' de forma
// confiable: Next envuelve TODOS los exports de un módulo cliente, incluidos
// los que no son componentes, en una referencia de cliente — así que
// TERMS_SECTIONS.map() truena en el servidor. Este archivo no tiene
// directiva 'use client' ni 'use server', así que ambos lados lo importan
// igual de bien.
//
// Marco general de protección legal para la plataforma y su equipo de desarrollo.
// Recomendación: someter a revisión de un abogado con cédula en México antes de
// lanzamiento a producción — este texto es una base robusta, no asesoría legal.
export const TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Aceptación de los Términos',
    body: 'Al registrarte, publicar una propiedad o utilizar cualquier función de Vive Villahermosa (la "Plataforma"), aceptas quedar obligado por estos Términos y Condiciones (los "Términos"). Si no estás de acuerdo, no debes usar la Plataforma. El uso continuado después de cualquier modificación constituye tu aceptación de los cambios.',
  },
  {
    title: '2. Naturaleza del servicio',
    body: 'Vive Villahermosa es una plataforma tecnológica que facilita el contacto entre personas que desean publicar, buscar, comprar o rentar bienes inmuebles en el estado de Tabasco, México. No somos una inmobiliaria, agente inmobiliario, corredor, notario ni parte en ninguna transacción entre usuarios. No verificamos la titularidad legal, el estado físico, jurídico o registral de los inmuebles publicados, ni la identidad, solvencia o intenciones de los usuarios.',
  },
  {
    title: '3. Responsabilidad del usuario sobre el contenido publicado',
    body: 'Quien publica una propiedad declara, bajo su exclusiva responsabilidad, que: (a) tiene derecho legal para publicarla, venderla o rentarla; (b) la información, fotografías, precio y características publicadas son veraces, exactas y no engañosas; y (c) cuenta con el consentimiento de cualquier tercero cuya información o imagen se incluya en la publicación. Vive Villahermosa no revisa, valida ni garantiza la exactitud de ningún contenido publicado por los usuarios y no asume responsabilidad alguna por errores, omisiones o falsedades en dicho contenido.',
  },
  {
    title: '4. Exclusión de responsabilidad sobre transacciones entre usuarios',
    body: 'La Plataforma únicamente pone en contacto a las partes interesadas. Cualquier negociación, visita, contrato de compraventa o arrendamiento, pago, anticipo, depósito o acuerdo de cualquier naturaleza se realiza directa y exclusivamente entre los usuarios involucrados, bajo su propio riesgo. Vive Villahermosa no participa, no interviene, no es garante ni parte de dichos acuerdos, y no será responsable por incumplimientos, fraudes, daños, pérdidas económicas, vicios ocultos, controversias posesorias o cualquier conflicto derivado de una transacción entre usuarios.',
  },
  {
    title: '5. Información de riesgo de inundación',
    body: 'La clasificación de riesgo de inundación mostrada en la Plataforma tiene carácter exclusivamente informativo y de referencia. Se basa en el Atlas de Riesgos del Municipio de Centro y otros registros históricos disponibles públicamente, que pueden estar desactualizados, ser incompletos o no aplicar con precisión a un predio específico. Esta clasificación no constituye una garantía, dictamen técnico, asesoría profesional ni responsabilidad de la Plataforma. Recomendamos verificar esta información directamente con el H. Ayuntamiento, IMPLAN, Protección Civil u otra autoridad competente antes de tomar cualquier decisión de compra, renta o inversión.',
  },
  {
    title: '6. Usos prohibidos',
    body: 'Está prohibido usar la Plataforma para: publicar información falsa, fraudulenta o engañosa; publicar propiedades que no te pertenecen o que no estás autorizado a ofrecer; suplantar la identidad de otra persona; discriminar por origen étnico, género, religión, orientación sexual, discapacidad o cualquier otra condición protegida por la ley; enviar spam, virus o contenido malicioso; realizar extracción automatizada de datos (scraping) sin autorización; interferir con la infraestructura, seguridad o funcionamiento de la Plataforma; o cualquier otro uso contrario a la ley aplicable o a la buena fe.',
  },
  {
    title: '7. Moderación y suspensión de cuentas',
    body: 'Vive Villahermosa se reserva el derecho de revisar, editar, rechazar o eliminar cualquier publicación, así como de suspender o cancelar cuentas de usuario, en cualquier momento y sin previo aviso, cuando exista sospecha razonable de incumplimiento de estos Términos, fraude, mala fe o riesgo para otros usuarios o para la Plataforma, sin que ello genere derecho a indemnización alguna a favor del usuario afectado.',
  },
  {
    title: '8. Garantías y disponibilidad del servicio',
    body: 'La Plataforma se ofrece "tal cual" y "según disponibilidad", sin garantías de ningún tipo, expresas o implícitas, incluyendo garantías de comerciabilidad, idoneidad para un propósito particular, exactitud, disponibilidad ininterrumpida o ausencia de errores. No garantizamos que la Plataforma esté libre de fallas técnicas, interrupciones, pérdida de datos o vulnerabilidades de seguridad.',
  },
  {
    title: '9. Limitación de responsabilidad',
    body: 'En la máxima medida permitida por la legislación aplicable, Vive Villahermosa, sus fundadores, desarrolladores, programadores, colaboradores, empleados y proveedores no serán responsables por daños directos, indirectos, incidentales, especiales, consecuentes, punitivos o de cualquier otra naturaleza —incluyendo pérdidas económicas, pérdida de datos, lucro cesante o daño moral— que deriven del uso o la imposibilidad de uso de la Plataforma, de errores u omisiones en el contenido, de transacciones entre usuarios, de fallas técnicas, o de la conducta de terceros, aun cuando se hubiera advertido de la posibilidad de dichos daños.',
  },
  {
    title: '10. Indemnización',
    body: 'El usuario se obliga a indemnizar, defender y sacar en paz y a salvo a Vive Villahermosa, sus fundadores, desarrolladores y colaboradores, de cualquier reclamación, demanda, sanción, daño o gasto —incluyendo honorarios legales razonables— derivado de: (a) el incumplimiento de estos Términos; (b) el contenido publicado por el usuario; (c) el uso indebido de la Plataforma; o (d) la violación de derechos de terceros.',
  },
  {
    title: '11. Propiedad intelectual',
    body: 'La marca "Vive Villahermosa", el diseño, la estructura, el código fuente y demás elementos de la Plataforma son propiedad de sus desarrolladores y están protegidos por la legislación aplicable en materia de propiedad intelectual. El usuario conserva los derechos sobre el contenido que publica, pero otorga a Vive Villahermosa una licencia no exclusiva, gratuita y mundial para almacenar, mostrar y distribuir dicho contenido dentro de la Plataforma con el único fin de operar el servicio.',
  },
  {
    title: '12. Datos personales',
    body: 'El tratamiento de los datos personales proporcionados en la Plataforma se rige por nuestro Aviso de Privacidad, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Al usar la Plataforma, aceptas que tu información de contacto sea visible para otros usuarios interesados en tus publicaciones.',
  },
  {
    title: '13. Ausencia de relación laboral o societaria',
    body: 'El uso de la Plataforma no crea relación laboral, de agencia, sociedad, mandato, franquicia o representación entre el usuario y Vive Villahermosa o su equipo de desarrollo.',
  },
  {
    title: '14. Modificaciones',
    body: 'Vive Villahermosa podrá modificar estos Términos en cualquier momento. Los cambios serán efectivos a partir de su publicación en la Plataforma. Es responsabilidad del usuario revisarlos periódicamente.',
  },
  {
    title: '15. Legislación aplicable y jurisdicción',
    body: 'Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos y del Estado de Tabasco. Para su interpretación y cumplimiento, las partes se someten a la jurisdicción de los tribunales competentes de Villahermosa, Tabasco, renunciando expresamente a cualquier otro fuero que pudiera corresponderles por razón de su domicilio presente o futuro.',
  },
  {
    title: '16. Divisibilidad',
    body: 'Si alguna disposición de estos Términos fuera declarada inválida o inaplicable por autoridad competente, dicha disposición se limitará o eliminará en la medida mínima necesaria, y las demás disposiciones continuarán vigentes con pleno efecto.',
  },
];
