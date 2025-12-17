'use client';

import React from 'react';
import { FolderOpen, Link2, FileText, ImageIcon, Video, FileArchive } from 'lucide-react';
import type { ResourceTab } from '@/models';

interface ResourceTabsProps {
  activeTab: ResourceTab;
  onTabChange: (tab: ResourceTab) => void;
  counts: {
    all: number;
    links: number;
    documents: number;
    images: number;
    videos: number;
    others: number;
  };
}

const tabs = [
  { id: 'all' as ResourceTab, label: 'Todos', icon: FolderOpen },
  { id: 'links' as ResourceTab, label: 'Links', icon: Link2 },
  { id: 'documents' as ResourceTab, label: 'Documentos', icon: FileText },
  { id: 'images' as ResourceTab, label: 'Imágenes', icon: ImageIcon },
  { id: 'videos' as ResourceTab, label: 'Videos', icon: Video },
  { id: 'others' as ResourceTab, label: 'Otros', icon: FileArchive },
];

export const ResourceTabs: React.FC<ResourceTabsProps> = ({ activeTab, onTabChange, counts }) => {
  return (
    <div className='mb-6 border-b border-[var(--text-secondary)]/20'>
      <div className='flex space-x-1 overflow-x-auto pb-2'>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
              }`}
            >
              <Icon className='h-4 w-4' />
              <span className='text-sm font-medium'>{tab.label}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? 'bg-white/20'
                    : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                }`}
              >
                {counts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
