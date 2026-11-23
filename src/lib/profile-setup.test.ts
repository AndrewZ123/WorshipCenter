import { describe, expect, it } from 'vitest';
import { shouldOpenProfileSetup } from './profile-setup';

describe('shouldOpenProfileSetup', () => {
  it('stays closed after Skip even when the user has no name', () => {
    expect(shouldOpenProfileSetup({ hasName: false, setupCompleted: true })).toBe(false);
  });

  it('stays closed after completing setup when the user has a name', () => {
    expect(shouldOpenProfileSetup({ hasName: true, setupCompleted: true })).toBe(false);
  });

  it('opens on a first visit without a name', () => {
    expect(shouldOpenProfileSetup({ hasName: false, setupCompleted: false })).toBe(true);
  });

  it('opens on a first visit when the user already has a name', () => {
    expect(shouldOpenProfileSetup({ hasName: true, setupCompleted: false })).toBe(true);
  });
});
