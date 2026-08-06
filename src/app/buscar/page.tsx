import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

/**
 * Reenvía TODOS los parámetros recibidos, no solo `q` — SearchBar.tsx ahora
 * también manda filtros estructurados (municipio, tipo, precioMax, etc.)
 * que la búsqueda inteligente con IA extrae del texto libre; antes esta
 * página solo leía `q` y descartaba cualquier otro parámetro.
 */
export default async function BuscarPage({ searchParams }: Props) {
  const params = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  const query = usp.toString();
  redirect(`/propiedades${query ? `?${query}` : ''}`);
}
