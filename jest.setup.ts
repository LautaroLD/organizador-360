// Polyfill global fetch para entorno de test Node.js
import fetch from 'node-fetch';
if (!global.fetch) {
  global.fetch = fetch as any;
}
// Learn more: https://github.com/testing-library/jest-dom
/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom';
import React from 'react';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
// @ts-expect-error Global type mismatch for TextDecoder
global.TextDecoder = TextDecoder;

// Polyfill Request/Response para tests de API y Next.js
if (typeof Request === 'undefined') {
    // @ts-expect-error Polyfill for Request
    global.Request = class Request {
        url: string;
        method: string;
        headers: Headers;
        body: any;
        constructor(input: string | Request, init?: any) {
            this.url = typeof input === 'string' ? input : input.url;
            this.method = init?.method || 'GET';
            this.headers = new Headers(init?.headers);
            this.body = init?.body;
        }
        json() { return Promise.resolve(JSON.parse(this.body)); }
    };
}

if (typeof Response === 'undefined') {
    // @ts-expect-error Polyfill for Response
    global.Response = class Response {
        status: number;
        statusText: string;
        headers: Headers;
        body: any;
        ok: boolean;
        constructor(body?: any, init?: any) {
            this.status = init?.status || 200;
            this.statusText = init?.statusText || '';
            this.headers = new Headers(init?.headers);
            this.body = body;
            this.ok = this.status >= 200 && this.status < 300;
        }
        json() { 
            return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body); 
        }
    };
}

if (typeof Headers === 'undefined') {
    // @ts-expect-error Polyfill for Headers
    global.Headers = class Headers {
        map: Map<string, string>;
        constructor(init?: any) {
            this.map = new Map();
            if (init) {
                Object.keys(init).forEach(key => this.map.set(key, init[key]));
            }
        }
        append(key: string, value: string) { this.map.set(key, value); }
        delete(key: string) { this.map.delete(key); }
        get(key: string) { return this.map.get(key) || null; }
        has(key: string) { return this.map.has(key); }
        set(key: string, value: string) { this.map.set(key, value); }
        forEach(callback: any) { this.map.forEach(callback); }
    };
}

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
   
  default: (props: any) => {
    return React.createElement('img', props);
  },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  })),
}));

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    root: Element | null = null;
    rootMargin: string = '';
    thresholds: ReadonlyArray<number> = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
    disconnect() {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    observe(_target: Element) {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    unobserve(_target: Element) {}
  };
}

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
