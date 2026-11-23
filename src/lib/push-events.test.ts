import { describe, expect, it } from 'vitest';
import {
  findMentionedUserIds,
  mentionPush,
  truncatePushBody,
} from './push-events';

const users = [
  { id: 'user-1', name: 'Jane Doe' },
  { id: 'user-2', name: 'John Smith' },
  { id: 'user-3', name: 'John Adams' },
];

describe('findMentionedUserIds', () => {
  it('matches full names after @', () => {
    expect(findMentionedUserIds('Thanks @Jane Doe for covering!', users)).toEqual([
      'user-1',
    ]);
  });

  it('matches a unique first name', () => {
    expect(findMentionedUserIds('hey @Jane can you check?', users)).toEqual([
      'user-1',
    ]);
  });

  it('requires a full name when a first name is ambiguous', () => {
    expect(findMentionedUserIds('hey @John can you check?', users)).toEqual([]);
    expect(findMentionedUserIds('hey @John Smith can you check?', users)).toEqual([
      'user-2',
    ]);
  });

  it('does not match a longer name that merely starts with a mention', () => {
    expect(findMentionedUserIds('@Janet is not Jane', users)).toEqual([]);
  });

  it('is case-insensitive and ignores an email-like string', () => {
    expect(findMentionedUserIds('CC @jane doe', users)).toEqual(['user-1']);
    expect(findMentionedUserIds('mail me at jane@example.com', users)).toEqual([]);
  });

  it('returns every distinct mentioned user', () => {
    expect(
      findMentionedUserIds('@Jane Doe and @John Adams please respond', users)
    ).toEqual(['user-1', 'user-3']);
  });
});

describe('truncatePushBody', () => {
  it('keeps short bodies and collapses whitespace', () => {
    expect(truncatePushBody('  hello\n\nworld  ')).toBe('hello world');
  });

  it('caps bodies at 120 characters including the ellipsis', () => {
    const result = truncatePushBody('x'.repeat(200));
    expect(result.length).toBe(120);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('mentionPush', () => {
  it('never includes a message body longer than 120 characters', () => {
    const payload = mentionPush({
      senderName: 'Jane Doe',
      message: 'y'.repeat(400),
      label: 'Sunday Service chat',
      url: '/services/service-1?tab=chat',
    });

    expect(payload.body.length).toBeLessThanOrEqual(120);
    expect(payload.data.url).toBe('/services/service-1?tab=chat');
  });
});
