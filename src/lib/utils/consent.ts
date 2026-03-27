export type ConsentStatus = 'accepted' | 'rejected' | null;

export function getConsent(): ConsentStatus {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('cookie_consent') as ConsentStatus;
}

export function setConsent(status: 'accepted' | 'rejected'): void {
  localStorage.setItem('cookie_consent', status);

  if (typeof window !== 'undefined' && 'gtag' in window) {
    const granted = status === 'accepted';
    (window as any).gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
    });
  }
}

export function hasConsented(): boolean {
  return getConsent() !== null;
}
