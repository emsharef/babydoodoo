'use client';
import { LanguageProvider } from './LanguageContext';
import BabyProvider from './BabyContext';

export default function ClientProviders({ children }) {
  return (
    <LanguageProvider>
      <BabyProvider>
        {children}
      </BabyProvider>
    </LanguageProvider>
  );
}
