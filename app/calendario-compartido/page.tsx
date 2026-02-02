import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Calendario compartido',
  description:
    'Calendario compartido para equipos con sincronización con Google Calendar, eventos y recordatorios en un solo lugar.',
};

export default function CalendarioCompartidoPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="space-y-6">
        <p className="text-sm text-[var(--text-secondary)]">
          Veenzo · Calendario compartido para equipos
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)]">
          Calendario compartido con sincronización en tiempo real
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Organiza reuniones, hitos y entregas con un calendario compartido que
          se integra con Google Calendar. Mantén a todo el equipo alineado con
          recordatorios y eventos centralizados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Sincronización automática
          </h2>
          <p className="text-[var(--text-secondary)]">
            Conecta Google Calendar y actualiza eventos en tiempo real.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Visibilidad por proyecto
          </h2>
          <p className="text-[var(--text-secondary)]">
            Filtra eventos por equipo o proyecto y evita solapamientos.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Recordatorios inteligentes
          </h2>
          <p className="text-[var(--text-secondary)]">
            Notificaciones automáticas para tareas y eventos clave.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Contexto de trabajo
          </h2>
          <p className="text-[var(--text-secondary)]">
            Vincula tareas y proyectos a eventos para dar contexto al equipo.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)] p-8">
        <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">
          Un calendario compartido diseñado para equipos
        </h2>
        <p className="text-[var(--text-secondary)] mb-6">
          Veenzo integra el calendario con tareas y comunicación para que la
          planificación sea clara y colaborativa.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-md bg-[var(--accent-primary)] px-5 py-2.5 text-white hover:opacity-90 transition"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-[var(--text-secondary)] px-5 py-2.5 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
