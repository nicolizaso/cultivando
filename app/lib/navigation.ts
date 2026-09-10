import {
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  RefreshCw,
  Sprout,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Se muestra en la hoja "Más", donde hay sitio para explicar la sección. */
  description: string;
}

/**
 * Fuente única de la navegación. Antes la barra inferior y la superior
 * mantenían dos listas paralelas que ya no coincidían: la de escritorio tenía
 * seis secciones y la de móvil cinco, y Nutrición sólo era alcanzable desde un
 * menú escondido.
 *
 * Ahora la jerarquía es explícita:
 *   · PRIMARY   lo que se toca a diario -> pestañas en móvil.
 *   · SECONDARY la configuración del cultivo -> hoja "Más" en móvil.
 * En escritorio hay sitio para las seis en una sola línea.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Panel', icon: LayoutDashboard, description: 'Resumen del día y cultivo activo' },
  { href: '/cycles', label: 'Ciclos', icon: RefreshCw, description: 'Tandas de cultivo, activas y cerradas' },
  { href: '/plants', label: 'Plantas', icon: Sprout, description: 'Inventario completo con filtros' },
  { href: '/calendar', label: 'Agenda', icon: CalendarDays, description: 'Calendario de tareas y registros' },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/spaces', label: 'Espacios', icon: Warehouse, description: 'Carpas, armarios y exterior' },
  { href: '/fertilizers', label: 'Nutrición', icon: FlaskConical, description: 'Fertilizantes y combos de riego' },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

/**
 * Una sección sigue activa dentro de sus páginas de detalle: estando en
 * /plants/12 la pestaña Plantas queda marcada, que es lo que el usuario espera.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
