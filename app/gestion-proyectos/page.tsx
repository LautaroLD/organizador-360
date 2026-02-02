import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Gestión de proyectos',
  description:
    'Software de gestión de proyectos con Kanban, tareas, documentación y colaboración en tiempo real para equipos.',
};

export default function GestionProyectosPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="space-y-6">
        <p className="text-sm text-[var(--text-secondary)]">
          Veenzo · Software de gestión de proyectos
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)]">
          Gestión de proyectos con Kanban, tareas y documentación
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Planifica, ejecuta y controla tus proyectos con una herramienta de
          gestión de proyectos pensada para equipos modernos. Veenzo integra
          tareas, base de conocimiento y comunicación en un solo lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Tableros Kanban
          </h2>
          <p className="text-[var(--text-secondary)]">
            Organiza las tareas por estados y visualiza el avance del proyecto en
            tiempo real.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Base de conocimiento
          </h2>
          <p className="text-[var(--text-secondary)]">
            Centraliza documentación, archivos y enlaces para que el equipo
            encuentre todo rápido.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Colaboración integrada
          </h2>
          <p className="text-[var(--text-secondary)]">
            Chat por proyecto, menciones y notificaciones para colaborar sin
            herramientas externas.
          </p>
        </div>
        <div className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Reportes y métricas
          </h2>
          <p className="text-[var(--text-secondary)]">
            Analiza progreso, carga de trabajo y productividad del equipo.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)] p-8">
        <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">
          Una herramienta moderna para gestionar proyectos
        </h2>
        <p className="text-[var(--text-secondary)] mb-6">
          Veenzo es un software de gestión de proyectos diseñado para equipos
          que necesitan visibilidad, orden y comunicación en una sola plataforma.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-md bg-[var(--accent-primary)] px-5 py-2.5 text-white hover:opacity-90 transition"
          >
            Probar gratis
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
