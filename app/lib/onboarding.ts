/**
 * Cookie que deja "Omitir por ahora" en el asistente de bienvenida. La lee el
 * panel en el servidor para no volver a abrirlo en cada visita. Vive aparte
 * porque la usan un componente de servidor y uno de cliente.
 */
export const ONBOARDING_SKIPPED_COOKIE = 'onboarding_omitido';

/** Un año: si alguien quiere el asistente de nuevo, borra las cookies. */
export const ONBOARDING_SKIPPED_MAX_AGE = 60 * 60 * 24 * 365;
