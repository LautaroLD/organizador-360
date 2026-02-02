import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Gestión de equipos',
  description:
    'Aplicación para gestión de equipos con chat, roles, tareas y calendario compartido. Mejora la colaboración y la productividad.',
};

export default function GestionEquiposPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="space-y-6">
        <p className="text-sm text-[var(--text-secondary)]">
          Veenzo · Aplicación de gestión de equipos
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)]">
          Gestión de equipos con chat, tareas y calendario compartido
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Centraliza la comunicación y el trabajo diario en una sola plataforma.
          Veenzo es una aplicación de gestión de equipos que combina Kanban,
          chat en tiempo real, roles y un calendario compartido para mantener a
          todos sincronizados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Comunicación clara
          </h2>
          <p className="text-[var(--text-secondary)]">
            Chat en tiempo real por proyecto y notificaciones para no perder
            decisiones clave.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Roles y permisos
          </h2>
          <p className="text-[var(--text-secondary)]">
            Controla el acceso con roles Owner, Admin y Member y define
            responsabilidades claras.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Kanban y tareas
          </h2>
          <p className="text-[var(--text-secondary)]">
            Visualiza el flujo de trabajo con tableros Kanban, estados y
            responsables.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Calendario compartido
          </h2>
          <p className="text-[var(--text-secondary)]">
            Sincroniza eventos y fechas clave con Google Calendar para alinear
            al equipo.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)] p-8">
        <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">
          ¿Buscas una aplicación para gestionar equipos?
        </h2>
        <p className="text-[var(--text-secondary)] mb-6">
          Veenzo ayuda a equipos remotos y presenciales a coordinar tareas,
          proyectos y comunicación en un solo lugar.
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
