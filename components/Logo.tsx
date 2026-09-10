import React from 'react';

type LogoProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  strokeWidth?: number;
};

/**
 * Marca de Cultivando: un brote de tres trazos.
 *
 * Se dibuja con la misma gramática que los iconos de la interfaz (viewBox de
 * 24, trazo redondeado, `currentColor`) para que funcione indistintamente como
 * logotipo a 40px y como icono de pestaña a 22px sin empastarse.
 */
export default function Logo({ className = 'w-6 h-6', strokeWidth = 2, ...props }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      <path d="M12 21V10.5" />
      <path d="M12 11c0-4.42 3.58-8 8-8 0 4.42-3.58 8-8 8z" />
      <path d="M12 15.5c-3.31 0-6-2.69-6-6 3.31 0 6 2.69 6 6z" />
    </svg>
  );
}
