'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  useEffect(() => {
    // Redirigir automáticamente al chat cuando se accede a /projects/[id]
    if (projectId) {
      router.replace(`/projects/${projectId}/chat`);
    }
  }, [projectId, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-primary)]">
      <p className="text-[var(--text-secondary)]">Cargando...</p>
    </div>
  );
}
