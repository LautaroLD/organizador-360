'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import { createClient } from '@/lib/supabase/client';
import { Settings, LogOut, ChevronDown, Home, Code2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Link from 'next/link';
import clsx from 'clsx';
import Image from 'next/image';
import { useThemeStore } from '@/store/themeStore';
import Logo from './Logo';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const supabase = createClient();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const path = usePathname();
  const location = { pathname: path };
  const { theme } = useThemeStore();
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      logout();
      toast.success('Sesión cerrada');
      router.push('/');
    } catch {
      toast.error('Error al cerrar sesión');
    }
  };

  const closeMenu = () => {
    setIsUserMenuOpen(false);
  };
  const [screenWidth, setScreenWidth] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    handleResize(); // Set initial width
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, []);
  console.log(theme);
  return (
    <header className="border-b border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] sticky top-0 z-30">

      <div className="flex items-center justify-between border-b border-[var(--text-secondary)]/20 px-6 py-2">
        <Link href='/dashboard' className={clsx('flex items-center', !location.pathname.includes('/projects') ? 'flex' : 'hidden')}>
          {screenWidth !== null && screenWidth >= 640 ? (
            <Logo />
          ) :
            <Image src='/veenzo-logo-square.png' alt='Veenzo' width={40} height={40} />
          }
        </Link>


        <div className="flex items-center space-x-4 ml-auto">
          <ThemeToggle />

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
            >
              <div className="flex items-center space-x-2">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-sm font-semibold">
                  {user?.user_metadata.name[0]}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-[var(--text-primary)] max-w-[150px] truncate">
                    {user?.user_metadata.name ?? 'Usuario'}
                  </p>
                </div>
              </div>

              <ChevronDown
                className={`h-4 w-4 text-[var(--text-secondary)] transition-transform ${isUserMenuOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg shadow-lg overflow-hidden z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-[var(--text-secondary)]/20">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate flex justify-between items-center">
                    {user?.email || 'Usuario'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Cuenta Personal
                  </p>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <Link href="/dashboard" onClick={closeMenu} className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors flex items-center space-x-3">
                    <Home className="h-4 w-4 text-[var(--text-secondary)]" />
                    <span>Inicio</span>
                  </Link>
                  <Link href="/settings"
                    onClick={closeMenu}
                    className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors flex items-center space-x-3"
                  >
                    <Settings className="h-4 w-4 text-[var(--text-secondary)]" />
                    <span>Configuración</span>
                  </Link>

                </div>

                {/* Logout */}
                <div className="border-t border-[var(--text-secondary)]/20 py-2">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center space-x-3"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {
        title && subtitle &&
        <div className='px-6 py-2'>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
          {subtitle && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">{subtitle}</p>
          )}
        </div>
      }
    </header>
  );
};
