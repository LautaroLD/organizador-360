# 🚀 DevCore - Plataforma de Colaboración Todo-en-Uno

> Una plataforma moderna de gestión de proyectos y colaboración en equipo, construida con Next.js 16, React 19 y Supabase.

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Desarrollo](#-desarrollo)
- [Testing](#-testing)
- [Despliegue](#-despliegue)
- [Arquitectura](#-arquitectura)
- [Scripts Disponibles](#-scripts-disponibles)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)

---

## ✨ Características

### 🎯 Gestión de Proyectos
- **Tablero Kanban** con drag & drop
- **Asignación de tareas** con roles personalizados
- **Sistema de etiquetas** para organización
- **Control de miembros** con límites por plan

### 💬 Chat en Tiempo Real
- **Mensajería instantánea** por proyecto
- **Canal general** para todo el equipo
- **Notificaciones push** en tiempo real
- **Historial de mensajes** persistente

### 📅 Calendario Compartido
- **Integración con Google Calendar**
- **Eventos recurrentes** (semanales/personalizados)
- **Sincronización bidireccional**
- **Vista mensual/lista** de eventos

### 📚 Base de Conocimiento
- **Repositorio de archivos** con límites de almacenamiento
- **Enlaces importantes** organizados
- **Categorización por tipo** (Archivos/Links/Todos)
- **Búsqueda y filtrado** avanzado

### 💳 Sistema de Suscripciones
- **Plan Free**: Hasta 10 miembros, 100MB storage
- **Plan Pro**: Miembros ilimitados, 5GB storage
- **Integración con Stripe** para pagos
- **Gestión de suscripciones** automática

### 🔐 Autenticación y Seguridad
- **OAuth con Google**
- **Autenticación tradicional** (email/password)
- **Row Level Security (RLS)** en Supabase
- **Invitaciones por token** seguras

### 🔔 Notificaciones
- **Push notifications** con Web Push API
- **Service Worker** para notificaciones offline
- **Logs de debugging** para diagnóstico

---

## 🛠 Tecnologías

### Frontend
- **[Next.js 16](https://nextjs.org/)** - Framework React con App Router
- **[React 19](https://react.dev/)** - Biblioteca UI
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS 4](https://tailwindcss.com/)** - Estilos utilitarios
- **[Zustand](https://zustand-demo.pmnd.rs/)** - Estado global
- **[React Query](https://tanstack.com/query/latest)** - Data fetching & caching
- **[React Hook Form](https://react-hook-form.com/)** - Gestión de formularios
- **[dnd-kit](https://dndkit.com/)** - Drag & drop

### Backend & Base de Datos
- **[Supabase](https://supabase.com/)** - Backend as a Service
  - PostgreSQL con RLS
  - Realtime subscriptions
  - Authentication
  - Storage
- **[Stripe](https://stripe.com/)** - Procesamiento de pagos

### APIs Externas
- **[Google Calendar API](https://developers.google.com/calendar)** - Sincronización de eventos
- **[Google OAuth](https://developers.google.com/identity/protocols/oauth2)** - Autenticación social
- **[Web Push](https://web.dev/push-notifications-overview/)** - Notificaciones push

### Herramientas de Desarrollo
- **[ESLint](https://eslint.org/)** - Linting
- **[Jest](https://jestjs.io/)** - Testing unitario
- **[Testing Library](https://testing-library.com/)** - Testing de componentes
- **[Playwright](https://playwright.dev/)** - Testing E2E

---

## 📦 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** >= 18.17.0
- **npm** >= 9.0.0 o **pnpm** >= 8.0.0
- **Git**
- Cuenta en **[Supabase](https://supabase.com/)**
- Cuenta en **[Stripe](https://stripe.com/)** (para pagos)
- **[Google Cloud Console](https://console.cloud.google.com/)** proyecto configurado

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/organizador.git
cd organizador
```

### 2. Instalar dependencias

```bash
npm install
# o
pnpm install
```

### 3. Configurar base de datos

```bash
# Ejecutar el schema en tu proyecto de Supabase
# Desde el dashboard de Supabase: SQL Editor > New query
# Copiar y ejecutar el contenido de schema.sql
```

---

## ⚙️ Configuración

### 1. Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
cp .env.example .env.local
```

Completa todas las variables (ver [.env.example](.env.example) para detalles).

### 2. Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard)
2. Ejecuta el archivo `schema.sql` en el SQL Editor
3. Configura las políticas RLS según tu lógica de negocio
4. Obtén las credenciales de API (Settings > API)

### 3. Configuración de Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto nuevo o selecciona uno existente
3. Habilita **Google Calendar API** y **Google+ API**
4. Crea credenciales OAuth 2.0:
   - Tipo: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/google/callback`
     - `https://tu-dominio.com/api/google/callback`
5. Copia Client ID y Client Secret a `.env.local`

### 4. Configuración de Stripe

1. Regístrate en [Stripe](https://dashboard.stripe.com/register)
2. Obtén tus API keys (Developers > API keys)
3. Crea productos y precios en el dashboard
4. Configura webhook endpoint: `https://tu-dominio.com/api/stripe/webhook`
5. Copia el Webhook Secret

### 5. Configuración de Web Push

```bash
# Generar VAPID keys
npx web-push generate-vapid-keys
```

Copia las keys generadas a `.env.local`.

---

## 💻 Desarrollo

### Iniciar servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### Estructura del proyecto

```
organizador/
├── app/                      # App Router de Next.js
│   ├── api/                  # API Routes
│   │   ├── auth/            # Autenticación
│   │   ├── google/          # Integración Google
│   │   ├── stripe/          # Webhooks de Stripe
│   │   └── push/            # Notificaciones push
│   ├── auth/                # Páginas de autenticación
│   ├── dashboard/           # Dashboard principal
│   ├── projects/[id]/       # Vista de proyecto
│   └── settings/            # Configuración de usuario
├── components/              # Componentes React
│   ├── ui/                  # Componentes UI base
│   ├── dashboard/           # Componentes del dashboard
│   ├── project/             # Componentes de proyecto
│   ├── calendar/            # Componentes de calendario
│   ├── members/             # Gestión de miembros
│   └── resources/           # Gestión de recursos
├── hooks/                   # Custom React hooks
├── lib/                     # Utilidades y helpers
│   ├── supabase/           # Cliente de Supabase
│   ├── googleCalendar.ts   # Integración con Google
│   ├── stripe.ts           # Integración con Stripe
│   └── webpush.ts          # Web Push notifications
├── models/                  # TypeScript types & models
├── providers/              # Context Providers
├── store/                  # Zustand stores
├── public/                 # Assets estáticos
│   ├── manifest.json       # PWA manifest
│   └── sw.js              # Service Worker
└── supabase/              # Migraciones de DB
    └── migrations/
```

### Convenciones de código

- **Componentes**: PascalCase (`MyComponent.tsx`)
- **Utilidades**: camelCase (`myUtil.ts`)
- **Hooks**: camelCase con prefijo `use` (`useMyHook.ts`)
- **Tipos**: PascalCase con sufijo Type o Interface
- **Constantes**: UPPER_SNAKE_CASE

---

## 🧪 Testing

### Tests Unitarios

```bash
# Ejecutar todos los tests
npm test

# Ejecutar con coverage
npm run test:coverage

# Watch mode para desarrollo
npm run test:watch
```

### Tests E2E

```bash
# Ejecutar tests de Playwright
npm run test:e2e

# Modo UI interactivo
npm run test:e2e:ui

# Generar reporte
npm run test:e2e:report
```

### Escribir Tests

```typescript
// Ejemplo: __tests__/components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

---

## 🚢 Despliegue

### Vercel (Recomendado)

1. Push tu código a GitHub
2. Importa el proyecto en [Vercel](https://vercel.com/new)
3. Configura las variables de entorno
4. Deploya automáticamente

```bash
# O usando Vercel CLI
npm i -g vercel
vercel
```

### Docker

```bash
# Build
docker build -t organizador .

# Run
docker run -p 3000:3000 organizador
```

### Variables de Entorno en Producción

Asegúrate de configurar TODAS las variables de `.env.example` en tu plataforma de deployment.

---

## 🏗 Arquitectura

### Flujo de Autenticación

```
Usuario → Next.js Auth API → Supabase Auth → JWT Token → RLS Policies
```

### Realtime Subscriptions

```typescript
// Ejemplo de suscripción realtime
const channel = supabase
  .channel('project-messages')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      // Manejar nuevo mensaje
    }
  )
  .subscribe();
```

### Sistema de Roles y Permisos

- **owner**: Control total del proyecto
- **admin**: Puede gestionar miembros y configuración
- **member**: Puede ver y participar
- **viewer**: Solo lectura

### Límites por Plan

| Feature | Free | Pro |
|---------|------|-----|
| Miembros por proyecto | 10 | ∞ |
| Almacenamiento | 100MB | 5GB |
| Proyectos | ∞ | ∞ |
| Google Calendar | ✅ | ✅ |

---

## 📜 Scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build para producción
npm run start        # Iniciar servidor de producción
npm run lint         # Ejecutar ESLint
npm test             # Tests unitarios
npm run test:e2e     # Tests E2E
npm run test:coverage # Coverage report
```

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una branch para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Guía de Contribución

- Escribe tests para nuevas funcionalidades
- Actualiza la documentación si es necesario
- Sigue las convenciones de código existentes
- Asegúrate de que todos los tests pasen

---

## 🐛 Reportar Bugs

Si encuentras un bug, por favor abre un [issue](https://github.com/tu-usuario/organizador/issues) con:

- Descripción clara del problema
- Pasos para reproducirlo
- Comportamiento esperado vs actual
- Screenshots si aplica
- Información del entorno (OS, browser, versión)

---

## 📚 Recursos Adicionales

- [Documentación de Next.js](https://nextjs.org/docs)
- [Guía de Supabase](https://supabase.com/docs)
- [React Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)

---

## 🔒 Seguridad

Si descubres una vulnerabilidad de seguridad, por favor envía un email a security@tudominio.com en lugar de usar el issue tracker público.

---

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 👥 Equipo

Desarrollado con ❤️ por [Tu Nombre/Equipo]

---

## 🙏 Agradecimientos

- Next.js team por el increíble framework
- Supabase por el excelente BaaS
- Todos los contribuidores open source

---

## 📞 Contacto

- Website: [https://tudominio.com](https://tudominio.com)
- Email: contacto@tudominio.com
- Twitter: [@tuhandle](https://twitter.com/tuhandle)

---

**⭐ Si este proyecto te resulta útil, considera darle una estrella en GitHub!**
