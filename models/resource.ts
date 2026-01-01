/**
 * Resource Models
 * Tipos relacionados con recursos del proyecto
 */

export interface ResourceUploader {
  name: string;
  email: string;
}

export interface Resource {
  id: string;
  project_id?: string;
  title: string;
  type: string;
  url: string;
  uploaded_by?: string;
  created_at: string;
  uploader?: ResourceUploader;
  size?: number;
}

export interface ResourceCardProps {
  resource: Resource;
  onDelete: (resource: Resource) => void;
  selected?: boolean;
  onSelect?: (resource: Resource, selected: boolean) => void;
  selectionMode?: boolean;
}

export interface LinkFormData {
  title: string;
  url: string;
}

export interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LinkFormData) => void;
  isLoading: boolean;
}

export interface UploadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export type ResourceTab = 'all' | 'links' | 'documents' | 'images' | 'videos' | 'others';
