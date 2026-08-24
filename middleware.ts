import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Presupuesto máximo para hablar con Supabase Auth desde el middleware.
 * Vercel corta la invocación a los 25s (MIDDLEWARE_INVOCATION_TIMEOUT), así que
 * cortamos nosotros mucho antes y dejamos pasar la request.
 */
const AUTH_TIMEOUT_MS = 3000;

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ['/login'];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * @supabase/ssr guarda la sesión en cookies `sb-<ref>-auth-token`
 * (partidas en `.0`, `.1`... cuando el JWT es grande).
 * Si no hay ninguna, sabemos que no hay sesión sin salir a la red.
 */
function hasAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
    );
}

/** fetch con AbortSignal para que ninguna llamada quede colgada. */
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) });

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sin configuración de Supabase el middleware no puede decidir nada:
  // dejamos pasar en vez de colgarnos contra una URL indefinida.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  // Camino rápido: no hay cookie de sesión => no hay usuario. Cero llamadas de red.
  if (!hasAuthCookie(request)) {
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  let user = null;

  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch {
    // Timeout o Supabase caído: no bloqueamos la navegación.
    // Los Server Components y las políticas RLS siguen validando la sesión.
    return response;
  }

  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Solo rutas de página. Se excluyen API, internos de Next, y cualquier
     * archivo con extensión (imágenes, fuentes, manifiesto, iconos...), para
     * que un asset no dispare una verificación de sesión contra Supabase.
     */
    '/((?!api|_next/|.*\\.[\\w]+$).*)',
  ],
};
