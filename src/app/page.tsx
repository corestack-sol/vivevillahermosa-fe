import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ChevronRight, Shield, ArrowRight, Zap,
  MessageCircle, Droplets, Camera, CheckCircle2, Sparkles, Bot,
} from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { ClickableMap } from '@/components/map/ClickableMap';
import { getFeaturedProperties, getAllProperties, getColoniasOrdenadasPorDemanda, getStats } from '@/lib/api';
import { buttonClasses } from '@/components/ui/Button';
import { RecentlyViewedSection } from '@/components/property/RecentlyViewedSection';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Carousel } from '@/components/ui/Carousel';
// ⚠️ PlanesInmobiliaria oculto a propósito (ver docs/BACKEND.md, sección
// "V2.A — Panel profesional para inmobiliarias", nota sobre la página de
// precios): esta sección promete "Anuncios destacados en el catálogo" y
// "Perfil de agencia verificado", pero ninguno de los dos funciona de
// verdad todavía — destacados solo reordena dentro de tu propio navegador
// (localStorage, ver propiedadesLocales.ts), y verificacionDemo.ts nunca se
// muestra en ninguna página pública. Mostrar precios por algo que no se
// cumple dañaría la confianza justo con las inmobiliarias que se quiere
// convencer. También coincide con el plan de negocio
// (docs/tabasco-proptech.html): mínimo 12 meses gratis para inmobiliarias
// en el lanzamiento, sin presión de monetización temprana. Reactivar cuando
// V2.A esté lista (destacados/verificación reales) y se decida activar cobro.
// import { PlanesInmobiliaria } from '@/components/home/PlanesInmobiliaria';

export const metadata: Metadata = {
  title: 'Vive Villahermosa | Casas en renta y venta en Villahermosa y Tabasco',
  description:
    'Casas, departamentos, terrenos y locales en Villahermosa, Paraíso, Cárdenas y todo Tabasco. Sin intermediarios, sin comisiones. Publica gratis.',
};

const QUICK_LINKS: { href: string; label: string; Icon?: typeof Zap }[] = [
  { href: '/propiedades?tipo=casa&operacion=renta',  label: 'Casas en renta' },
  { href: '/propiedades?tipo=departamento',          label: 'Departamentos' },
  { href: '/propiedades?tipo=habitacion',            label: 'Habitaciones' },
  { href: '/propiedades?tipo=terreno',               label: 'Terrenos' },
  { href: '/propiedades?dosBocas=true',              label: 'Dos Bocas', Icon: Zap },
];

// Mismo criterio que FEATURES arriba: un color por ícono en vez del mismo
// bg-white/8 repetido ×4 — sobre fondo oscuro, así que van con /20 en vez
// de /15 para que el tinte se note contra el verde bosque.
const PUBLISH_STEPS = [
  { time: '5 min', label: 'Subes fotos y datos', Icon: Camera, bg: 'bg-brand-light/20', fg: 'text-brand-light' },
  { time: 'Inmediato', label: 'Tu anuncio se publica', Icon: CheckCircle2, bg: 'bg-sky/20', fg: 'text-sky' },
  {
    // "Ese día" prometía un tiempo que la plataforma no controla (depende
    // de que un interesado real escriba, no de nosotros) — "Directo" habla
    // de CÓMO llega el mensaje (sin intermediarios/filtros), no de CUÁNDO.
    time: 'Directo', label: 'Recibes mensajes', Icon: MessageCircle, bg: 'bg-coral/20', fg: 'text-coral',
  },
  { time: '$0', label: 'Sin comisión', Icon: Sparkles, bg: 'bg-cta/20', fg: 'text-cta' },
];

// Un color distinto por ícono en vez del mismo bg-brand-pale repetido ×3 —
// Droplets ya usa el azul semántico de "agua" (coincide con el badge de
// riesgo de inundación más abajo en la página), Zap usa coral ("vida"/
// energía), MessageCircle se queda en el verde de marca.
const FEATURES = [
  { Icon: MessageCircle, title: 'WhatsApp o correo', sub: 'Tú eliges cómo te contactan: por WhatsApp, correo, o ambos.', bg: 'bg-brand-pale', fg: 'text-brand' },
  // "si la zona se inunda" sonaba a predicción propia (¿ahora? ¿va a
  // inundarse?) — el dato real es el registro histórico del Atlas de
  // Riesgos, mismo criterio ya aplicado en FLOOD_LABEL (floodColors.ts:
  // "Riesgo alto de inundación" → "Históricamente inundable"). Se
  // acortó de paso (line-clamp-2 en una tarjeta de 300px de ancho no
  // tiene margen para una oración larga) y de paso queda igual de
  // conciso que las otras dos tarjetas del carrusel.
  { Icon: Droplets, title: 'Alerta de inundación', sub: 'Te decimos qué zonas de Tabasco se han inundado históricamente.', bg: 'bg-sky/15', fg: 'text-sky' },
  { Icon: Zap, title: 'Anuncio activo en 5 min', sub: 'Sube fotos, llena datos, publica. Sin comisión, sin trámites.', bg: 'bg-coral/15', fg: 'text-coral' },
];

export default async function HomePage() {
  const featured = await getFeaturedProperties();
  // getColoniasOrdenadasPorDemanda (no getFeaturedZones/`destacada`) — misma
  // fuente que ya usa /zonas para sus tarjetas grandes: por DEMANDA real
  // (BACKEND.md §9.1) cuando ya hay algún evento registrado, con respaldo
  // honesto a oferta si no. Antes esta sección mostraba las colonias
  // marcadas `destacada:true` a mano en zones.json, sin ninguna señal real
  // detrás de esa selección — mismo problema que ya se había corregido en
  // /zonas. Pedido explícito (2026-08-09): nada en la plataforma debe
  // quedarse en datos sueltos/editoriales si ya existe una fuente real que
  // se pueda usar en su lugar.
  const { colonias: coloniasPorDemanda, porDemanda } = await getColoniasOrdenadasPorDemanda();
  const zones = coloniasPorDemanda.slice(0, 4);
  const stats = await getStats();

  // getAllProperties (no `featured`) — pedido explícito (2026-08-09): el
  // mapa mostraba solo las 5 propiedades marcadas `featured:true`, la
  // misma curación editorial que ya usan las tarjetas de abajo, aunque el
  // catálogo real tiene 31. El mapa no es una vitrina curada como las
  // tarjetas — su valor es mostrar dónde hay propiedades reales en todo
  // Tabasco, así que usa el catálogo completo. `fitToMarkers` en
  // ClickableMap (ver ese componente) ya encuadra para que se vean todas,
  // sin importar cuántas ni qué tan dispersas estén.
  const markers = (await getAllProperties()).map((p) => ({
    id: p.id, slug: p.slug, lat: p.lat, lng: p.lng,
    titulo: p.titulo, precio: p.precio, operacion: p.operacion,
    tipo: p.tipo, colonia: p.colonia, foto: p.fotos[0] ?? null,
    riesgoInundacion: p.riesgoInundacion,
  }));

  return (
    <div>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* Un fondo oscuro no es el registro correcto para una inmobiliaria —
          Zillow, Airbnb, Redfin, Idealista van a fondos claros y cálidos
          porque el producto es "encontrar un hogar", no algo corporativo.
          Este hero es claro y cálido (brand-pale → sand), y es justo ese
          contraste — verde oscuro arriba, claro abajo — lo que hace que el
          header no se pierda, sin sacrificar la sensación de la marca.

          Collage de íconos de Tabasco (cacao, marimba, pejelagarto, cabeza
          olmeca, iguana, garza, sombrero, canoa, torre petrolera, puente,
          skyline) — public/images/hero-bg-collage.webp. Pasó por SVG
          8.4MB → JPG 1280×720 (22-28KB) → WebP 4000×2250 (74KB): la
          versión de 1280px se veía borrosa en pantallas anchas porque
          `background-size: cover` la agrandaba más allá de su resolución
          real (esta `<section>` no tiene `max-w`, ocupa el ancho completo
          de la pantalla) — no era un problema de compresión ni de
          formato, era de origen. La versión de 4000px cubre cualquier
          monitor real sin necesidad de agrandarla. El canal alfa del PNG
          original no aportaba nada (imagen ya opaca) pero sí costaba peso
          — aplanarlo a blanco sólido antes de codificar bajó el archivo
          de 450KB a 74KB con el mismo resultado visual. Se apila sobre el
          mismo degradado de antes (no lo reemplaza) vía `background-image`
          con dos capas — el degradado de abajo sigue sirviendo de base
          para cualquier borde que la imagen no alcance a cubrir. */}
      <section
        className="relative"
        style={{
          backgroundImage: 'url(/images/hero-bg-collage.webp), linear-gradient(to bottom right, var(--color-brand-pale), #ffffff, var(--color-sand))',
          backgroundSize: 'cover, cover',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'no-repeat, no-repeat',
        }}
      >
        {/* Glow — muy sutil, textura y no bloque de color. El overflow-hidden
            vive en este wrapper (no en la <section>) a propósito: es solo
            para recortar estos círculos de brillo, que se salen del borde
            adrede — ponerlo en la sección completa también recortaba el
            dropdown de sugerencias/historial del SearchBar (un descendiente
            posicionado absoluto más abajo), dejándolo cortado detrás del
            carrusel de la sección siguiente. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* rgba en vez de var(--color-brand)/var(--color-accent): un
              radial-gradient necesita el color con su propio alpha, y
              CSS no puede componer una var() de #hex con una opacidad
              aparte dentro del mismo valor — se escriben literales,
              actualizados a mano junto con la paleta de globals.css cada
              vez que cambie. */}
          <div className="absolute -top-20 right-0 w-[550px] h-[450px] rounded-full blur-[130px]" style={{ background: 'radial-gradient(ellipse, rgba(63,107,74,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-[350px] h-[350px] rounded-full blur-[110px]" style={{ background: 'radial-gradient(ellipse, rgba(181,100,58,0.14) 0%, transparent 70%)' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-20 md:pb-28">
          {/* Eyebrow */}
          {/* Entrada escalonada al cargar la página — mismo keyframe
              fadeUp/animate-fade-up que ya existía en globals.css (pensado
              para esto) pero que nunca se usaba fuera de PublishForm. El
              delay creciente por elemento (animationDelay inline, no una
              clase nueva por cada valor) hace que la sección completa entre
              en cascada en vez de todos los bloques apareciendo a la vez. */}
          <div className="flex items-center gap-2 mb-6 animate-fade-up">
            <span className="w-2 h-2 rounded-full bg-coral animate-pulse" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">Tabasco · México · 100% gratuito</span>
          </div>

          {/* Headline — the whole pitch in 4 words */}
          {/* Verde propio (--color-brand-headline, globals.css), no
              text-brand-dark — el mismo tono que header/footer se sentía
              plano en un titular grande, este es más saturado a propósito. */}
          <h1 className="font-display font-black leading-[0.92] mb-6 animate-fade-up"
            style={{ fontSize: 'clamp(2.8rem, 8vw, 5.5rem)', letterSpacing: '-0.03em', color: 'var(--color-brand-headline, #0A4F48)', animationDelay: '90ms' }}>
            Sin agente.<br />
            <span className="text-coral">Sin comisión.</span><br />
            Encuentra hoy.
          </h1>

          <p className="text-gray-600 text-base md:text-lg mb-8 max-w-lg leading-relaxed animate-fade-up" style={{ animationDelay: '180ms' }}>
            Más de {stats.propiedadesActivas} propiedades en Tabasco. Hablas directo con el dueño.
            Sin formularios, sin esperas, sin intermediarios.
          </p>

          {/* Search */}
          {/* relative z-20 aquí, no solo en el <form> de SearchBar — este
              div anima transform/opacity (animate-fade-up), y eso crea su
              propio contexto de apilamiento en los navegadores reales
              (aunque la animación ya haya terminado). El z-20 que se le
              puso al <form> quedaba atrapado DENTRO de este contenedor, sin
              poder competir contra "Social proof bar" (su hermano) más
              abajo — hay que promover el nivel que en verdad compite con
              ese hermano, no un nieto más adentro. */}
          <div className="relative z-20 max-w-2xl animate-fade-up" style={{ animationDelay: '270ms' }}>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-wide bg-brand-pale px-3 py-1 rounded-full mb-2">
              <Bot size={14} /> Búsqueda con IA
            </span>
            <SearchBar placeholder="Ej: casa cerca de Dos Bocas que no se inunde, renta hasta $12,000" />
            <p className="text-xs text-gray-400 mt-2">
              Escríbelo como si le hablaras a una persona — la IA entiende zona, precio, tipo de propiedad y riesgo de inundación.
            </p>
          </div>

          {/* Social proof bar — animate-count (globals.css) ya existía
              justo para números de estadística; cada cifra entra por
              separado, un pelín después de la búsqueda. */}
          <div className="flex flex-wrap items-center gap-5 mt-10 pt-8 border-t border-gray-900/10">
            {[
              { n: `${stats.propiedadesActivas}+`, label: 'propiedades activas' },
              { n: `${stats.municipiosCubiertos}`,  label: 'municipios cubiertos' },
              { n: '$0',                             label: 'para publicar' },
              { n: '5 min',                          label: 'para tener tu anuncio activo' },
            ].map((s, i) => (
              <div key={s.label} className="flex items-baseline gap-1.5 animate-count" style={{ animationDelay: `${360 + i * 60}ms` }}>
                <span className="font-display font-black text-2xl text-brand-dark">{s.n}</span>
                <span className="text-gray-400 text-xs">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FEATURE BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* Carrusel angosto y centrado — la ventana visible mide exactamente 3
          ítems (300px c/u = 900px), así los 3 bloques se ven a la vez y el
          que va desapareciendo por la izquierda es reemplazado por el que
          reaparece por la derecha (el track duplica FEATURES y se anima
          -50%, así que siempre son exactamente 3 en pantalla, nunca un
          cuarto asomándose ni un texto repetido). Título y descripción usan
          line-clamp para quedar en 1 y 2 líneas fijas respectivamente —
          con 3 bloques visibles al mismo tiempo, alturas desparejas se
          notan mucho más que cuando solo se veía uno a la vez. */}
      <section className="bg-white border-b border-gray-100">
        <div className="w-[900px] max-w-full mx-auto overflow-hidden">
          <div
            className="py-6"
            style={{
              // 20px -> 90px: el fade original apenas se notaba en una
              // ventana de 900px (2% del ancho por lado) — los bloques
              // aparecían/desaparecían casi de golpe en vez de disolverse.
              maskImage: 'linear-gradient(to right, transparent 0, black 90px, black calc(100% - 90px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 90px, black calc(100% - 90px), transparent 100%)',
            }}
          >
            <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
              {[...FEATURES, ...FEATURES].map((f, i) => (
                <div key={i} className="flex items-start gap-3 w-[300px] flex-shrink-0 px-4">
                  <span className={`w-10 h-10 rounded-xl ${f.bg} ${f.fg} flex items-center justify-center flex-shrink-0`}>
                    <f.Icon size={18} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-heading font-bold text-gray-900 leading-snug mb-1 line-clamp-1">{f.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ DESTACADAS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
            <div>
              <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-1.5">Recién publicadas</p>
              <h2 className="text-3xl font-display font-black text-gray-900 leading-tight">Propiedades destacadas</h2>
            </div>
            <Link href="/propiedades" className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark group">
              Ver todas <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Accesos rápidos por tipo/zona — antes vivían en el hero */}
          <div className="flex flex-wrap items-center gap-2 mb-7">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-brand bg-white border border-gray-200 hover:border-brand/40 hover:bg-brand-pale/40 px-3.5 py-2 rounded-full transition-all">
                {l.Icon && <l.Icon size={13} />}
                {l.label}
              </Link>
            ))}
          </div>

          {/* Carrusel deslizable en móvil/tablet (evita una lista larga de
              4 columnas apiladas en 1, mucho scroll vertical) — grid
              estático desde lg:, donde ya hay ancho de sobra para verlas
              todas sin scroll horizontal. Pedido explícito 2026-08-20. */}
          <Carousel
            trackClassName="gap-4 pb-1"
            desktopGridClassName="lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:snap-none"
          >
            {featured.slice(0, 8).map((p) => (
              <div key={p.id} className="flex-shrink-0 w-[72%] sm:w-[42%] snap-start lg:w-auto">
                <PropertyCard property={p} />
              </div>
            ))}
          </Carousel>
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ VISTOS RECIENTEMENTE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <RecentlyViewedSection />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FLOOD RISK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white border-y border-gray-100 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-brand-pale text-brand text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                <Shield size={12} /> Solo en Vive Villahermosa
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-black text-gray-900 leading-tight mb-4">
                ¿La casa se inunda<br />en temporada de lluvias?
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6 max-w-md">
                La información completa beneficia a todos: quien busca llega con certeza, quien publica atrae al comprador indicado. Por eso el nivel de riesgo hídrico va incluido en cada propiedad.
              </p>
              <div className="space-y-3 mb-7">
                {[
                  { color: 'var(--color-success)', bg: '#D1FAE5', label: 'Bajo historial de inundaciones', desc: 'Pocas o ninguna inundación registrada' },
                  { color: 'var(--color-warning)', bg: '#FEF3C7', label: 'Inundaciones menores ocasionales', desc: 'Anegamiento leve en temporada de lluvias' },
                  { color: 'var(--color-danger)', bg: '#FEE2E2', label: 'Históricamente inundable',  desc: 'Inundaciones severas documentadas' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: r.bg }}>
                      <span className="w-3 h-3 rounded-full" style={{ background: r.color }} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{r.label}</span>
                      <span className="text-sm text-gray-400 ml-2">{r.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/mapa" className={buttonClasses('secondary', 'xl', 'group')}>
                Ver mapa de riesgo
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Mini map */}
            <div className="h-80 rounded-2xl overflow-hidden border border-gray-200 shadow-md">
              <ClickableMap markers={markers} zoom={11} />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ZONES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-end justify-between mb-7">
          <div>
            {/* "Las más buscadas"/"Zonas populares" afirmaban una demanda
                que nadie medía, y luego "Selección del equipo" (aquí)
                afirmaba una curación editorial que tampoco era real: en
                ambos casos, no había ningún dato detrás de la elección.
                Corregido igual que /zonas (ver getColoniasOrdenadasPorDemanda
                en api.ts): por DEMANDA real (BACKEND.md §9.1) cuando ya hay
                algún evento registrado, con el mismo respaldo honesto a
                oferta que usa /zonas si todavía no hay ninguno — misma
                fuente que /zonas para sus tarjetas grandes, no hay una
                selección aparte que mantener sincronizada a mano. */}
            <p className="text-xs font-bold text-brand uppercase tracking-[0.15em] mb-1.5">Datos en tiempo real</p>
            <h2 className="text-3xl font-display font-black text-gray-900 leading-tight">
              {porDemanda ? 'Colonias más buscadas' : 'Colonias con más propiedades'}
            </h2>
          </div>
          <Link href="/zonas" className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark group">
            Ver todas <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Antes cada tarjeta tenía un color distinto sin relación entre sí
            (esmeralda, azul, ámbar, violeta, teal, rosa) — un arcoíris
            compitiendo por atención, así que se unificó a un solo tono de
            marca repetido. Eso dejó las 4 tarjetas planas/apagadas — ahora
            alternan 3 variantes DENTRO de la misma familia (marca/acento/
            coral), no un arcoíris de vuelta: distinguibles entre sí sin
            perder cohesión. Gradiente por `style` (no clases from-X/to-X)
            porque "coral" necesita un stop oscurecido con color-mix() que
            Tailwind no genera como utilidad. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {zones.map((zone, i) => {
            const gradientes = [
              'linear-gradient(to bottom right, var(--color-brand-dark), var(--color-brand))',
              'linear-gradient(to bottom right, var(--color-accent-dark), var(--color-accent))',
              'linear-gradient(to bottom right, color-mix(in srgb, var(--color-coral) 55%, black), var(--color-coral))',
            ];
            // Sin ficha editorial en zones.json, zone.slug es null (colonia
            // real detectada solo por sus propiedades, sin página propia
            // todavía) — mismo fallback que ya usa /zonas/page.tsx: enlaza
            // al catálogo filtrado por nombre en vez de a un slug que no
            // existe.
            const href = zone.slug ? `/zonas/${zone.slug}` : `/propiedades?q=${encodeURIComponent(zone.nombre)}`;
            return (
              <Link key={zone.nombre} href={href}
                style={{ background: gradientes[i % gradientes.length] }}
                className="group relative h-40 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <p className="font-heading font-bold text-white text-sm leading-snug">{zone.nombre}</p>
                  <p className="text-white/60 text-xs mt-0.5">{zone.propiedades} propiedades</p>
                </div>
                <div className="absolute top-3 left-3">
                  <span className="bg-black/30 backdrop-blur-sm text-white/80 text-[10px] font-medium px-2 py-0.5 rounded-full">
                    {zone.municipio}
                  </span>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={16} className="text-white" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PUBLISH CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* Antes era un degradado de tres tonos (era el bloque más "cargado"
          del home) — un color plano y sólido es más contenido, y de paso
          hace eco del header: el mismo brand-dark abre y cierra la página. */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="relative rounded-3xl overflow-hidden bg-brand-dark">
          {/* Glow — un solo acento sutil, no el fondo entero */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/3 w-[400px] h-[200px] rounded-full blur-[90px]" style={{ background: 'rgba(110,145,102,0.18)' }} />
          </div>

          <div className="relative p-8 md:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* Left */}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#F3C89A' }}>Para propietarios</p>
                <h2 className="font-display font-black text-white leading-tight mb-4"
                  style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', letterSpacing: '-0.03em' }}>
                  Tu propiedad activa<br />en 5 minutos.
                </h2>
                <p className="text-white/50 text-sm leading-relaxed max-w-sm mb-6">
                  Sin trámites. Sin intermediarios. Tú eliges si el interesado te escribe por WhatsApp, correo, o ambos.
                </p>
                <Link href="/publicar"
                  className={buttonClasses('primary', 'xl', 'group shadow-lg')}
                  style={{ boxShadow: '0 8px 30px rgba(196,52,74,0.35)' }}>
                  Publicar gratis ahora
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Right: steps */}
              <div className="space-y-3">
                {PUBLISH_STEPS.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-4 bg-white/5 hover:bg-white/8 border border-white/8 rounded-2xl px-5 py-4 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${step.bg} ${step.fg}`}>
                      <step.Icon size={18} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 leading-snug">{step.label}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: i === 3 ? 'rgba(196,52,74,0.25)' : 'rgba(255,255,255,0.08)', color: i === 3 ? '#F0A0AC' : 'rgba(255,255,255,0.5)' }}>
                        {step.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PLANES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* Oculto a propósito — ver el comentario junto al import de PlanesInmobiliaria arriba. */}
    </div>
  );
}
