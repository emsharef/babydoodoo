'use client';
import { LanguageProvider } from './LanguageContext';
import BabyProvider from './BabyContext';
import InviteBanner from './InviteBanner';

export default function ClientProviders({ children }) {
  return (
    <LanguageProvider>
      <BabyProvider>
        <InviteBanner />
        {children}
      </BabyProvider>
    </LanguageProvider>
  );
}
