import { describe, expect, it } from 'vitest';
import {
  getSwapIneligibilityReasons,
  isSwapEligible,
  isDateBlocked,
  type SwapEligibilityContext,
} from './eligibility';

const baseContext: SwapEligibilityContext = {
  churchId: 'church-1',
  assignmentId: 'assignment-1',
  assignmentTeamMemberId: 'tm-requester',
  role: 'vocals',
  serviceId: 'service-1',
  serviceDate: '2099-06-14',
  blockouts: [],
  sameDateAssignments: [
    {
      id: 'assignment-1',
      service_id: 'service-1',
      team_member_id: 'tm-requester',
      service_date: '2099-06-14',
      status: 'confirmed',
    },
  ],
};

const candidate = {
  id: 'tm-candidate',
  church_id: 'church-1',
  roles: ['vocals', 'keys'],
};

describe('swap eligibility', () => {
  it('accepts a same-church teammate with the role and no conflicts', () => {
    expect(isSwapEligible(candidate, baseContext)).toBe(true);
    expect(getSwapIneligibilityReasons(candidate, baseContext)).toEqual([]);
  });

  it('rejects a teammate from another church', () => {
    expect(
      getSwapIneligibilityReasons(
        { ...candidate, church_id: 'church-2' },
        baseContext
      )
    ).toContain('not_same_church');
  });

  it('rejects a teammate without the required role', () => {
    expect(
      getSwapIneligibilityReasons({ ...candidate, roles: ['drums'] }, baseContext)
    ).toContain('missing_role');
  });

  it('rejects the requester claiming their own swap', () => {
    expect(
      getSwapIneligibilityReasons(
        { ...candidate, id: 'tm-requester' },
        baseContext
      )
    ).toContain('is_requester');
  });

  it('rejects a teammate blocked out on the service date', () => {
    const context = {
      ...baseContext,
      blockouts: [
        {
          team_member_id: 'tm-candidate',
          start_date: '2099-06-01',
          end_date: '2099-06-20',
        },
      ],
    };
    expect(getSwapIneligibilityReasons(candidate, context)).toContain('blocked');
  });

  it('does not treat another member blockout as the candidate blockout', () => {
    const context = {
      ...baseContext,
      blockouts: [
        {
          team_member_id: 'tm-other',
          start_date: '2099-06-01',
          end_date: '2099-06-20',
        },
      ],
    };
    expect(isSwapEligible(candidate, context)).toBe(true);
  });

  it('rejects a teammate already serving that service', () => {
    const context = {
      ...baseContext,
      sameDateAssignments: [
        ...baseContext.sameDateAssignments!,
        {
          id: 'assignment-2',
          service_id: 'service-1',
          team_member_id: 'tm-candidate',
          service_date: '2099-06-14',
          status: 'pending',
        },
      ],
    };
    expect(getSwapIneligibilityReasons(candidate, context)).toContain(
      'already_serving_service'
    );
  });

  it('rejects a teammate already serving another service that date', () => {
    const context = {
      ...baseContext,
      sameDateAssignments: [
        ...baseContext.sameDateAssignments!,
        {
          id: 'assignment-3',
          service_id: 'service-2',
          team_member_id: 'tm-candidate',
          service_date: '2099-06-14',
          status: 'confirmed',
        },
      ],
    };
    expect(getSwapIneligibilityReasons(candidate, context)).toContain(
      'already_serving_date'
    );
  });

  it('ignores declined assignments when checking conflicts', () => {
    const context = {
      ...baseContext,
      sameDateAssignments: [
        ...baseContext.sameDateAssignments!,
        {
          id: 'assignment-3',
          service_id: 'service-2',
          team_member_id: 'tm-candidate',
          service_date: '2099-06-14',
          status: 'declined',
        },
      ],
    };
    expect(isSwapEligible(candidate, context)).toBe(true);
  });

  it('handles blockout range boundaries inclusively', () => {
    const blockouts = [
      {
        team_member_id: 'tm-candidate',
        start_date: '2099-06-14',
        end_date: '2099-06-14',
      },
    ];
    expect(isDateBlocked('2099-06-14', blockouts, 'tm-candidate')).toBe(true);
    expect(isDateBlocked('2099-06-15', blockouts, 'tm-candidate')).toBe(false);
  });
});
