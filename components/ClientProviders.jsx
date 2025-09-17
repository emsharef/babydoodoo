'use client';
import BabyProvider from './BabyContext';
export default function ClientProviders({ children }) {
  return <BabyProvider>{children}</BabyProvider>;
}
