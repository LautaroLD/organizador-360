import { useThemeStore } from '@/store/themeStore';
import Image from 'next/image';
import React from 'react';

export default function Logo() {
  const { theme } = useThemeStore();
  return (
    <>
      {theme === 'light' ? (
        <Image src='/veenzo-logo-horizontal-light.svg' alt='Veenzo' width={130} height={30} />
      ) : (
        <Image src='/veenzo-logo-horizontal-dark.svg' alt='Veenzo' width={130} height={30} />
      )}
    </>
  );
}
