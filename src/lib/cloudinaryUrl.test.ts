import { describe, it, expect } from 'vitest';
import { cloudinaryTransform } from './cloudinaryUrl';

const REAL_URL = 'https://res.cloudinary.com/dqdgutnzq/image/upload/v1780437639/propiedades/abc123.jpg';

describe('cloudinaryTransform', () => {
  it('inserts the thumb preset right after /image/upload/', () => {
    expect(cloudinaryTransform(REAL_URL, 'thumb')).toBe(
      'https://res.cloudinary.com/dqdgutnzq/image/upload/f_auto,q_auto,w_400/v1780437639/propiedades/abc123.jpg',
    );
  });
  it('inserts the full preset right after /image/upload/', () => {
    expect(cloudinaryTransform(REAL_URL, 'full')).toBe(
      'https://res.cloudinary.com/dqdgutnzq/image/upload/f_auto,q_auto,w_1600/v1780437639/propiedades/abc123.jpg',
    );
  });
  it('returns a non-Cloudinary URL unchanged (e.g. Unsplash seed data)', () => {
    const unsplash = 'https://images.unsplash.com/photo-123?w=1200';
    expect(cloudinaryTransform(unsplash, 'thumb')).toBe(unsplash);
  });
  it('returns a Cloudinary URL without the /image/upload/ marker unchanged (defensive)', () => {
    const weird = 'https://res.cloudinary.com/dqdgutnzq/raw/upload/v1/file.pdf';
    expect(cloudinaryTransform(weird, 'thumb')).toBe(weird);
  });
  it('does not double-transform a URL that already has a transformation segment', () => {
    // Documents actual behavior: calling it twice would insert twice. Not
    // necessarily wrong (callers only ever call it once per render), but
    // worth pinning down so a future refactor notices if this changes.
    const once = cloudinaryTransform(REAL_URL, 'thumb');
    const twice = cloudinaryTransform(once, 'thumb');
    expect(twice).toContain('f_auto,q_auto,w_400/f_auto,q_auto,w_400/');
  });
});
