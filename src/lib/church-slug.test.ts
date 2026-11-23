import { describe, expect, it } from 'vitest';
import {
  deriveChurchSlug,
  getDisplayChurchSlug,
  slugifyChurchName,
} from './church-slug';

describe('church slug helpers', () => {
  it('slugifies a church name', () => {
    expect(slugifyChurchName('  ZZ Test Church (Cody QA)  ')).toBe(
      'zz-test-church-cody-qa'
    );
    expect(slugifyChurchName('Café & Co.')).toBe('cafe-co');
  });

  it('derives a stable identifier when the stored slug is missing', () => {
    expect(deriveChurchSlug('ZZ Test Church', 'a1b2c3d4-e5f6')).toBe(
      'zz-test-church-a1b2c3'
    );
    expect(deriveChurchSlug('', null)).toBe('church');
  });

  it('prefers an existing slug and never returns an empty field', () => {
    expect(getDisplayChurchSlug('existing-slug', 'Ignored Name', 'id')).toBe(
      'existing-slug'
    );
    expect(getDisplayChurchSlug('', 'ZZ Test Church', 'abc123')).toBe(
      'zz-test-church-abc123'
    );
    expect(getDisplayChurchSlug(null, '', '')).toBe('church');
  });
});
