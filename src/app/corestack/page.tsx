import type { Metadata } from 'next';
import Image from 'next/image';
import corestackLogo from '@/assets/corestack.png';
import styles from './corestack.module.css';

export const metadata: Metadata = {
  title: 'Corestack',
  robots: { index: false, follow: false },
};

export default function CorestackAnimationPage() {
  return (
    <div className={styles.stage}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <div className={styles.stack}>
        <div
          className={styles.logoWrap}
          style={{ ['--logo-mask' as string]: `url(${corestackLogo.src})` }}
        >
          <Image
            src={corestackLogo}
            alt="Corestack"
            className={styles.logo}
            priority
          />
          <div className={styles.glitchRed} aria-hidden="true" />
          <div className={styles.glitchCyan} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
