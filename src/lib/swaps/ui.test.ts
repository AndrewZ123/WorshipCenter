import { describe, expect, it } from 'vitest';
import {
  findActiveSwapForAssignment,
  getSwapActionVisibility,
  hasActiveSwap,
  isOwnAssignment,
  shouldShowSwapRequest,
} from './ui';

const assignment = {
  team_member_id: 'tm-1',
  team_member_user_id: 'user-1',
  status: 'confirmed',
};

const baseContext = {
  currentUserId: 'user-1',
  currentTeamMemberId: 'tm-1',
  serviceDate: '2099-06-14',
  serviceTime: '10:00',
  now: new Date('2026-01-01T00:00:00Z'),
};

describe('swap UI helpers', () => {
  it('recognizes the signed-in member by user id or team member id', () => {
    expect(isOwnAssignment(assignment, 'user-1', null)).toBe(true);
    expect(isOwnAssignment(assignment, null, 'tm-1')).toBe(true);
    expect(isOwnAssignment(assignment, 'user-2', 'tm-2')).toBe(false);
    expect(isOwnAssignment(assignment, null, null)).toBe(false);
  });

  it('shows request swap for an own future, active assignment', () => {
    expect(shouldShowSwapRequest(assignment, baseContext)).toBe(true);
  });

  it('hides request swap for someone else', () => {
    expect(
      shouldShowSwapRequest(assignment, { ...baseContext, currentUserId: 'user-2', currentTeamMemberId: 'tm-2' }),
    ).toBe(false);
  });

  it('hides request swap for past services', () => {
    expect(
      shouldShowSwapRequest(assignment, { ...baseContext, serviceDate: '2000-01-01' }),
    ).toBe(false);
  });

  it('hides request swap for declined assignments', () => {
    expect(
      shouldShowSwapRequest({ ...assignment, status: 'declined' }, baseContext),
    ).toBe(false);
  });

  it('hides request swap while a request is open or claimed', () => {
    expect(
      shouldShowSwapRequest(assignment, { ...baseContext, activeSwapStatus: 'open' }),
    ).toBe(false);
    expect(
      shouldShowSwapRequest(assignment, { ...baseContext, activeSwapStatus: 'claimed' }),
    ).toBe(false);
  });

  it('allows a new request after a resolved swap', () => {
    expect(
      shouldShowSwapRequest(assignment, {
        ...baseContext,
        activeSwapStatus: 'cancelled',
      }),
    ).toBe(true);
    expect(
      shouldShowSwapRequest(assignment, {
        ...baseContext,
        activeSwapStatus: 'declined',
      }),
    ).toBe(true);
  });

  it('finds only active swaps for an assignment', () => {
    const swaps = [
      { id: 'a', assignment_id: 'asg-1', status: 'cancelled' as const },
      { id: 'b', assignment_id: 'asg-1', status: 'open' as const },
    ];
    expect(findActiveSwapForAssignment(swaps, 'asg-1')?.id).toBe('b');
    expect(findActiveSwapForAssignment(swaps, 'asg-2')).toBeUndefined();
    expect(hasActiveSwap('approved')).toBe(false);
  });

  it('lets the requester only cancel their own active request', () => {
    expect(
      getSwapActionVisibility({ isOwn: true, isLeader: false, status: 'open' }),
    ).toEqual({ showCancel: true, showApprove: false, showDecline: false });
    expect(
      getSwapActionVisibility({ isOwn: true, isLeader: true, status: 'claimed' }),
    ).toEqual({ showCancel: true, showApprove: false, showDecline: false });
    expect(
      getSwapActionVisibility({ isOwn: true, isLeader: true, status: 'declined' }),
    ).toEqual({ showCancel: false, showApprove: false, showDecline: false });
  });

  it('lets leaders approve or decline only someone else claimed request', () => {
    expect(
      getSwapActionVisibility({ isOwn: false, isLeader: true, status: 'claimed' }),
    ).toEqual({ showCancel: false, showApprove: true, showDecline: true });
    expect(
      getSwapActionVisibility({ isOwn: false, isLeader: true, status: 'open' }),
    ).toEqual({ showCancel: false, showApprove: false, showDecline: false });
    expect(
      getSwapActionVisibility({ isOwn: false, isLeader: false, status: 'claimed' }),
    ).toEqual({ showCancel: false, showApprove: false, showDecline: false });
  });
});
