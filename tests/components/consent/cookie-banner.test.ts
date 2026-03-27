import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConsent, setConsent, hasConsented } from '@/lib/utils/consent';

describe('consent utilities', () => {
  let storageData: Record<string, string> = {};

  beforeEach(() => {
    storageData = {};

    // Create a proper localStorage mock
    const localStorageMock = {
      getItem: (key: string) => storageData[key] || null,
      setItem: (key: string, value: string) => {
        storageData[key] = value;
      },
      removeItem: (key: string) => {
        delete storageData[key];
      },
      clear: () => {
        storageData = {};
      },
      key: (index: number) => {
        const keys = Object.keys(storageData);
        return keys[index] || null;
      },
      length: Object.keys(storageData).length,
    };

    // Mock window object globally with gtag function
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: localStorageMock,
        gtag: vi.fn(),
      },
      writable: true,
    });

    // Also set localStorage directly for backward compatibility
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  it('returns null when no consent stored', () => {
    expect(getConsent()).toBeNull();
  });

  it('returns false for hasConsented when no consent stored', () => {
    expect(hasConsented()).toBe(false);
  });

  it('stores and retrieves accepted consent', () => {
    setConsent('accepted');
    expect(getConsent()).toBe('accepted');
    expect(hasConsented()).toBe(true);
  });

  it('stores and retrieves rejected consent', () => {
    setConsent('rejected');
    expect(getConsent()).toBe('rejected');
    expect(hasConsented()).toBe(true);
  });
});
