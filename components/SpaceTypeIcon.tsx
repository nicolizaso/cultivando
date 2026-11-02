import { Lamp, Sun, SunMoon, Warehouse } from "lucide-react";

/** El icono de cada tipo de espacio, el mismo que en el formulario que lo crea. */
export default function SpaceTypeIcon({ type, size = 16 }: { type?: string | null; size?: number }) {
  if (type === "Indoor") return <Lamp size={size} aria-hidden="true" />;
  if (type === "Outdoor") return <Sun size={size} aria-hidden="true" />;
  if (type === "Mixto") return <SunMoon size={size} aria-hidden="true" />;
  return <Warehouse size={size} aria-hidden="true" />;
}
