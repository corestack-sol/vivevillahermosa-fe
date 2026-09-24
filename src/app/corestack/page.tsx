import type { Metadata } from 'next';
import Image from 'next/image';
import corestackLogo from '@/assets/corestack.png';
import { RayosDeLuz } from '@/components/efectos/RayosDeLuz';
import styles from './corestack.module.css';

export const metadata: Metadata = {
  title: 'Corestack',
  robots: { index: false, follow: false },
};

export default function CorestackAnimationPage() {
  return (
    <div className={styles.stage}>
      {/* Rayos de luz con polvo (WebGL) — capa del fondo, por detrás de todo. */}
      <RayosDeLuz className="absolute inset-0" oclusor={{ selector: '[data-rayos-oclusor]', src: corestackLogo.src }} />
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <div className={styles.stack}>
        <div
          className={styles.logoWrap}
          data-rayos-oclusor
          style={{ ['--logo-mask' as string]: `url(${corestackLogo.src})` }}
        >
          <Image
            src={corestackLogo}
            alt="Corestack"
            className={styles.logo}
            priority
          />
          <div className={styles.luzLogo} aria-hidden="true" />
        </div>

        <p className={styles.titulo}>Corestack Solutions</p>
      </div>

      {/* Capa superior: los rayos que cruzan el logo van ENCIMA de él (screen = solo suma luz). */}
      <RayosDeLuz
        modo="sobre"
        className="pointer-events-none absolute inset-0 z-[3] mix-blend-screen"
        oclusor={{ selector: '[data-rayos-oclusor]', src: corestackLogo.src }}
      />
    </div>
  );
}
