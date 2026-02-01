'use client';

import React, { useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/Button';
import {
  MessageSquare,
  FileText,
  Calendar,
  Settings,
  Menu,
  X,
  ArrowLeft,
  Hash,
  Users,
  Layout,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { Project } from '@/models';
import Logo from '../ui/Logo';
const SidebarContent = ({ handleBackToDashboard, currentProject, menuItems, pathname, setIsOpen, user }: { handleBackToDashboard: () => void, currentProject: Project | null, menuItems: { id: string; icon: React.ReactNode; label: string; path: string; }[], pathname: string, setIsOpen: (isOpen: boolean) => void, user: { id: string; email?: string; } | null; }) => (
  <>
    <div className="p-4 border-b border-[var(--text-secondary)]/20">
      <Link href='/dashboard' className='flex items-center justify-center space-x-2 bg-[var(--bg-primary)] p-2 rounded-lg'>
        <Logo />
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBackToDashboard}
        className="w-full justify-start my-3"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver a Proyectos
      </Button>

      <div className="bg-[var(--bg-primary)] p-3 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Hash className="h-4 w-4 text-[var(--accent-primary)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">
            {currentProject?.name || 'Proyecto'}
          </h2>
        </div>
        {currentProject?.description && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
            {currentProject.description}
          </p>
        )}
        {currentProject?.userRole && (
          <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium">
            {currentProject.userRole}
          </span>
        )}
      </div>
    </div>

    <nav className="flex-1 p-4 space-y-2">
      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-2 mb-2">
        Navegación
      </p>
      {menuItems.map((item) => {
        const isActive = pathname === item.path;

        return (
          <Link
            href={item.path}
            key={item.id}
            onClick={() => {
              setIsOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
              }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>

    <div className="p-4 border-t border-[var(--text-secondary)]/20 space-y-2">
      <p className="text-xs text-[var(--text-secondary)] px-2">
        {user?.email}
      </p>
    </div>
  </>
);
export const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { user } = useAuthStore();
  const { currentProject, setCurrentProject } = useProjectStore();
  const projectId = params?.id as string;

  const handleBackToDashboard = () => {
    setCurrentProject(null);
    router.push('/dashboard');
  };

  const menuItems = [
    {
      id: 'chat',
      icon: <MessageSquare className="h-5 w-5" />,
      label: 'Chat',
      path: `/projects/${projectId}/chat`
    },
    {
      id: 'agent',
      icon: <Sparkles className="h-5 w-5" />,
      label: 'Asistente AI',
      path: `/projects/${projectId}/agent`
    },
    {
      id: 'kanban',
      icon: <Layout className="h-5 w-5" />,
      label: 'Tablero',
      path: `/projects/${projectId}/kanban`
    },
    {
      id: 'members',
      icon: <Users className="h-5 w-5" />,
      label: 'Miembros & Tags',
      path: `/projects/${projectId}/members`
    },
    {
      id: 'resources',
      icon: <FileText className="h-5 w-5" />,
      label: 'Recursos',
      path: `/projects/${projectId}/resources`
    },
    {
      id: 'calendar',
      icon: <Calendar className="h-5 w-5" />,
      label: 'Calendario',
      path: `/projects/${projectId}/calendar`
    }
  ];

  const projectTier = currentProject?.plan_tier === 'enterprise'
    ? 'enterprise'
    : (currentProject?.plan_tier === 'pro' || currentProject?.plan_tier === 'starter'
      ? currentProject?.plan_tier
      : (currentProject?.is_premium ? 'pro' : 'free'));

  const canSeeAnalytics = projectTier === 'enterprise' && (currentProject?.userRole === 'Owner' || currentProject?.userRole === 'Admin');

  if (canSeeAnalytics) {
    menuItems.push({
      id: 'analytics',
      icon: <BarChart3 className="h-5 w-5" />,
      label: 'Analíticas',
      path: `/projects/${projectId}/analytics`
    });
  }

  if (currentProject?.owner_id === user?.id) {
    menuItems.push({
      id: 'settings',
      icon: <Settings className="h-5 w-5" />,
      label: 'Configuración',
      path: `/projects/${projectId}/settings`

    });
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-lg border border-[var(--text-secondary)]/20"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Sidebar */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40 "
            onClick={() => setIsOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 h-full w-64 bg-[var(--bg-secondary)] border-r border-[var(--text-secondary)]/20 z-40 flex flex-col overflow-auto">
            <SidebarContent
              currentProject={currentProject}
              handleBackToDashboard={handleBackToDashboard}
              menuItems={menuItems}
              pathname={pathname}
              user={user}
              setIsOpen={setIsOpen}
            />
          </aside>
        </>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-[var(--bg-secondary)] border-r border-[var(--text-secondary)]/20 flex-col overflow-auto">
        <SidebarContent
          currentProject={currentProject}
          handleBackToDashboard={handleBackToDashboard}
          menuItems={menuItems}
          pathname={pathname}
          user={user}
          setIsOpen={setIsOpen}
        />
      </aside>
    </>
  );
};
