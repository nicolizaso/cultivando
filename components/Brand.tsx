import Logo from '@/components/Logo';

/** Nombre de la marca. Se importa desde acá para no repetirlo por la app. */
export const BRAND_NAME = 'Cultivando';
export const BRAND_TAGLINE = 'Tu cultivo, día por día';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { box: string; mark: string; text: string; gap: string }> = {
  sm: { box: 'h-8 w-8 rounded-[var(--radius-sm)]', mark: 'h-[18px] w-[18px]', text: 'text-[15px]', gap: 'gap-2.5' },
  md: { box: 'h-10 w-10 rounded-[var(--radius-md)]', mark: 'h-[22px] w-[22px]', text: 'text-lg', gap: 'gap-3' },
  lg: { box: 'h-14 w-14 rounded-[var(--radius-lg)]', mark: 'h-8 w-8', text: 'text-2xl', gap: 'gap-3.5' },
};

interface BrandLockupProps {
  size?: Size;
  /** Oculta el nombre visualmente y lo deja sólo para lectores de pantalla. */
  markOnly?: boolean;
  className?: string;
}

/**
 * Lockup completo: la marca sobre una tesela verde y el nombre al lado.
 * La tesela le da al logotipo un ancla sólida en cualquier fondo, que es lo
 * que le faltaba a la versión anterior (un trazo verde suelto sobre el lienzo).
 */
export default function BrandLockup({ size = 'sm', markOnly = false, className = '' }: BrandLockupProps) {
  const s = SIZES[size];

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center bg-brand text-[color:var(--brand-fg)] shadow-[var(--shadow-sm)] ${s.box}`}
        aria-hidden="true"
      >
        <Logo className={s.mark} strokeWidth={2.1} />
      </span>

      <span
        className={
          markOnly
            ? 'sr-only'
            : `font-title font-semibold tracking-tight text-fg ${s.text}`
        }
      >
        {BRAND_NAME}
      </span>
    </span>
  );
}
