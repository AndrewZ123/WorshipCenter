import { describe, expect, it } from 'vitest';
import {
  canRunChurchSetup,
  churchSetupStorageKey,
  hasTeamMemberBeyondCreator,
  isChurchSetupComplete,
  isValidSetupDate,
  profileSetupStorageKey,
  shouldOpenChurchSetup,
  validateChurchSetupService,
  validateChurchSetupSong,
  validateChurchSetupTeamMember,
} from './church-setup';

const incomplete = {
  hasService: false,
  hasSong: false,
  hasTeamMemberBeyondCreator: false,
};

const loaded = {
  contentLoaded: true,
  setupFlagLoaded: true,
};

const newChurch = {
  ...incomplete,
  ...loaded,
  role: 'admin',
  setupCompleted: false,
  profileSetupCompleted: true,
};

describe('shouldOpenChurchSetup', () => {
  it('opens only for a brand-new admin church after profile setup', () => {
    expect(shouldOpenChurchSetup(newChurch)).toBe(true);
  });

  it('stays closed while the profile wizard has not been handled yet', () => {
    expect(
      shouldOpenChurchSetup({
        ...newChurch,
        profileSetupCompleted: false,
      })
    ).toBe(false);
  });

  it('stays closed after skip/dismiss even when the church is brand new', () => {
    expect(
      shouldOpenChurchSetup({
        ...newChurch,
        setupCompleted: true,
      })
    ).toBe(false);
  });

  it('stays closed when the server flag is set', () => {
    expect(
      shouldOpenChurchSetup({
        ...newChurch,
        setupCompleted: true,
      })
    ).toBe(false);
  });

  it('stays closed when the church already has any setup content', () => {
    const existingChurches = [
      { ...newChurch, hasService: true },
      { ...newChurch, hasSong: true },
      { ...newChurch, hasTeamMemberBeyondCreator: true },
      {
        hasService: true,
        hasSong: true,
        hasTeamMemberBeyondCreator: true,
        ...loaded,
        role: 'admin',
        setupCompleted: false,
        profileSetupCompleted: true,
      },
    ];

    for (const state of existingChurches) {
      expect(shouldOpenChurchSetup(state)).toBe(false);
    }
  });

  it('never opens when setup content has not loaded or failed', () => {
    expect(
      shouldOpenChurchSetup({
        ...newChurch,
        contentLoaded: false,
      })
    ).toBe(false);
    expect(
      shouldOpenChurchSetup({
        ...newChurch,
        contentLoaded: undefined,
      })
    ).toBe(false);
  });

  it('never opens when the server setup flag has not loaded or failed', () => {
    expect(
      shouldOpenChurchSetup({
        ...newChurch,
        setupFlagLoaded: false,
      })
    ).toBe(false);
    expect(
      shouldOpenChurchSetup({
        ...newChurch,
        setupFlagLoaded: undefined,
      })
    ).toBe(false);
  });

  it('is hidden from leaders and team volunteers', () => {
    for (const role of ['leader', 'team'] as const) {
      expect(
        shouldOpenChurchSetup({
          ...newChurch,
          role,
        })
      ).toBe(false);
      expect(canRunChurchSetup(role)).toBe(false);
    }
  });
});

describe('isChurchSetupComplete', () => {
  it('treats any existing content as an already set-up church', () => {
    expect(isChurchSetupComplete(incomplete)).toBe(false);
    expect(isChurchSetupComplete({ ...incomplete, hasService: true })).toBe(true);
    expect(isChurchSetupComplete({ ...incomplete, hasSong: true })).toBe(true);
    expect(
      isChurchSetupComplete({
        ...incomplete,
        hasTeamMemberBeyondCreator: true,
      })
    ).toBe(true);
    expect(
      isChurchSetupComplete({
        hasService: true,
        hasSong: true,
        hasTeamMemberBeyondCreator: true,
      })
    ).toBe(true);
  });
});

describe('hasTeamMemberBeyondCreator', () => {
  const creator = {
    teamMemberId: 'creator-member',
    userId: 'creator-user',
    email: 'creator@example.com',
  };

  it('ignores the creator stored as a team member', () => {
    expect(
      hasTeamMemberBeyondCreator(
        [
          {
            id: 'creator-member',
            email: 'creator@example.com',
            user_id: 'creator-user',
          },
        ],
        creator
      )
    ).toBe(false);
  });

  it('detects an invited member', () => {
    expect(
      hasTeamMemberBeyondCreator(
        [
          {
            id: 'creator-member',
            email: 'creator@example.com',
            user_id: 'creator-user',
          },
          {
            id: 'new-member',
            email: 'volunteer@example.com',
            user_id: null,
          },
        ],
        creator
      )
    ).toBe(true);
  });

  it('still excludes the creator when only the email matches', () => {
    expect(
      hasTeamMemberBeyondCreator(
        [
          {
            id: 'same-person-new-row',
            email: 'CREATOR@example.com',
            user_id: null,
          },
        ],
        creator
      )
    ).toBe(false);
  });
});

describe('church setup validation helpers', () => {
  it('accepts a valid service and normalizes its title', () => {
    const result = validateChurchSetupService({
      title: '  Sunday Worship  ',
      date: '2026-11-29',
      time: '09:00',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Sunday Worship');
      expect(result.data.date).toBe('2026-11-29');
    }
  });

  it('rejects missing titles, impossible dates, and invalid times', () => {
    expect(
      validateChurchSetupService({ title: '', date: '2026-11-29', time: '09:00' }).success
    ).toBe(false);
    expect(
      validateChurchSetupService({ title: 'Worship', date: '2026-02-31', time: '09:00' }).success
    ).toBe(false);
    expect(
      validateChurchSetupService({ title: 'Worship', date: '2026-11-29', time: '25:00' }).success
    ).toBe(false);
  });

  it('validates the ISO date helper directly', () => {
    expect(isValidSetupDate('2026-11-29')).toBe(true);
    expect(isValidSetupDate('2026-02-31')).toBe(false);
    expect(isValidSetupDate('11/29/2026')).toBe(false);
  });

  it('requires a real email for invited team members and lowercases it', () => {
    const invalid = validateChurchSetupTeamMember({
      name: 'Ada Lovelace',
      email: 'not-an-email',
      role: 'Keys',
    });
    expect(invalid.success).toBe(false);

    const valid = validateChurchSetupTeamMember({
      name: 'Ada Lovelace',
      email: 'ADA@Example.com',
      role: 'Keys',
    });
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.email).toBe('ada@example.com');
  });

  it('accepts a simple song and rejects an unknown key', () => {
    expect(
      validateChurchSetupSong({ title: 'Amazing Grace', artist: 'John Newton', key: 'G' }).success
    ).toBe(true);
    expect(validateChurchSetupSong({ title: '' }).success).toBe(false);
    expect(
      validateChurchSetupSong({ title: 'Amazing Grace', key: 'H' }).success
    ).toBe(false);
  });
});

describe('storage keys', () => {
  it('namespaces completion flags by church and user', () => {
    expect(churchSetupStorageKey('church-1')).toBe('church_setup_completed_church-1');
    expect(profileSetupStorageKey('user-1')).toBe('profile_setup_completed_user-1');
  });
});
