'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { Sidebar } from '@/components/project/ProjectSidebar';
import { Header } from '@/components/ui/Header';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentProject, setCurrentProject } = useProjectStore();
  const [isLoading, setIsLoading] = useState(true);
  const projectId = params?.id as string;

  useEffect(() => {
    const loadProject = async () => {
      if (!user || !projectId) return;

      try {
        // Verificar que el usuario es miembro del proyecto
        const { data: memberData, error: memberError } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .single();

        if (memberError || !memberData) {
          router.push('/dashboard');
          return;
        }

        // Cargar datos del proyecto
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError || !projectData) {
          router.push('/dashboard');
          return;
        }

        setCurrentProject({ ...projectData, userRole: memberData.role });
      } catch (error) {
        console.error('Error loading project:', error);
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [user, projectId, router, setCurrentProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <Sidebar />
      <div className="lg:pl-64 min-h-dvh flex flex-col max-h-dvh overflow-hidden">
        <Header />
        {children}
      </div>
    </div>
  );
}
