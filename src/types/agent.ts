export interface Agent {
  id: string;
  nombre: string;
  zona: string;
  tel: string;
  email: string;
  foto: string;
  whatsapp: string;
  propiedadesActivas: number;
  descripcion?: string;
  verificado: boolean;
}
