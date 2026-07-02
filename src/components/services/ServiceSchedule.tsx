'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import type { Service, ServiceAssignmentPopulated, TeamMember } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatServiceDate } from '@/lib/formatDate';

interface ServiceScheduleProps {
  service: Service;
  churchId: string;
  currentUserId: string;
  highlightedAssignmentId?: string | null;
}

export default function ServiceSchedule({ 
  service, 
  churchId, 
  currentUserId,
  highlightedAssignmentId 
}: ServiceScheduleProps) {
  const [assignments, setAssignments] = useState<ServiceAssignmentPopulated[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Bulk assign state
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Fetch assignments
  useEffect(() => {
    loadAssignments();
  }, [service.id, churchId]);

  // Scroll to highlighted assignment
  useEffect(() => {
    if (highlightedAssignmentId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [assignments, highlightedAssignmentId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const data = await db.assignments.getByService(service.id, churchId);
      setAssignments(data);
    } catch (error) {
      console.error('[ServiceSchedule] Failed to load assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load schedule',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (assignmentId: string) => {
    try {
      setProcessing(assignmentId);
      
      const response = await fetch(`/api/assignments/${assignmentId}/confirm`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to confirm assignment');
      }

      toast({
        title: 'Confirmed!',
        description: 'Your attendance has been confirmed',
        status: 'success',
      });

      // Reload assignments
      await loadAssignments();
    } catch (error) {
      console.error('[ServiceSchedule] Failed to confirm:', error);
      toast({
        title: 'Error',
        description: 'Failed to confirm assignment',
        status: 'error',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (assignmentId: string) => {
    try {
      setProcessing(assignmentId);
      
      const response = await fetch(`/api/assignments/${assignmentId}/decline`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to decline assignment');
      }

      toast({
        title: 'Declined',
        description: 'You have declined this assignment',
        status: 'success',
      });

      // Reload assignments
      await loadAssignments();
    } catch (error) {
      console.error('[ServiceSchedule] Failed to decline:', error);
      toast({
        title: 'Error',
        description: 'Failed to decline assignment',
        status: 'error',
      });
    } finally {
      setProcessing(null);
    }
  };

  const loadTeamMembersForBulk = async () => {
    try {
      const members = await db.teamMembers.getByChurch(churchId);
      // Filter out members already assigned
      const assignedIds = new Set(assignments.map((a) => a.team_member_id));
      setTeamMembers(members.filter((m) => !assignedIds.has(m.id)));
    } catch (error) {
      console.error('[ServiceSchedule] Failed to load team members:', error);
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleBulkAssign = async () => {
    if (selectedMembers.size === 0 || !bulkRole.trim()) {
      toast({
        title: 'Missing information',
        description: 'Select at least one member and enter a role',
        status: 'warning',
      });
      return;
    }

    try {
      setBulkSaving(true);

      const response = await fetch('/api/assignments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          assignments: Array.from(selectedMembers).map((memberId) => ({
            team_member_id: memberId,
            role: bulkRole.trim(),
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create assignments');
      }

      const result = await response.json();
      toast({
        title: 'Success!',
        description: `Created ${result.created} assignment${result.created !== 1 ? 's' : ''}`,
        status: 'success',
      });

      // Reset and reload
      setShowBulkAdd(false);
      setSelectedMembers(new Set());
      setBulkRole('');
      await loadAssignments();
    } catch (error) {
      console.error('[ServiceSchedule] Bulk assign failed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create assignments',
        status: 'error',
      });
    } finally {
      setBulkSaving(false);
    }
  };

  const isHighlighted = (assignmentId: string) => {
    return assignmentId === highlightedAssignmentId;
  };

  const isOwnAssignment = (assignment: ServiceAssignmentPopulated) => {
    if (!assignment.team_member?.user_id) return false;
    return assignment.team_member.user_id === currentUserId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading schedule...</div>
      </div>
    );
  }

  if (assignments.length === 0 && !showBulkAdd) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No team members scheduled</h3>
        <p className="mt-1 text-sm text-gray-500">
          Add team members to the schedule to get started.
        </p>
        <div className="mt-4">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShowBulkAdd(true);
              loadTeamMembersForBulk();
            }}
          >
            Add Team Members
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Schedule</h3>
          <p className="text-sm text-gray-500">
            {formatServiceDate(service.date, service.time)}
          </p>
        </div>
        {!showBulkAdd && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowBulkAdd(true);
              loadTeamMembersForBulk();
            }}
          >
            + Add Members
          </Button>
        )}
      </div>

      {/* Bulk Add Panel */}
      {showBulkAdd && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Add Team Members</h4>
            <button
              onClick={() => {
                setShowBulkAdd(false);
                setSelectedMembers(new Set());
                setBulkRole('');
              }}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Role input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role / Position
            </label>
            <input
              type="text"
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value)}
              placeholder="e.g., Worship Leader, Guitar, Vocals, Drums..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Member selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Members {selectedMembers.size > 0 && `(${selectedMembers.size} selected)`}
            </label>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No available team members.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1 bg-white rounded-md border border-gray-200 p-2">
                {teamMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.has(member.id)}
                      onChange={() => toggleMemberSelection(member.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Avatar name={member.name} src={member.avatar_url} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{member.roles}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowBulkAdd(false);
                setSelectedMembers(new Set());
                setBulkRole('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkAssign}
              isDisabled={bulkSaving || selectedMembers.size === 0 || !bulkRole.trim()}
            >
              {bulkSaving ? 'Adding...' : `Add ${selectedMembers.size || ''} Member${selectedMembers.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            ref={isHighlighted(assignment.id) ? highlightedRef : null}
            className={`
              rounded-lg border p-4 transition-colors
              ${isHighlighted(assignment.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Avatar
                  name={assignment.team_member?.name || 'Unknown'}
                  src={assignment.team_member?.avatar_url}
                  size="md"
                />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {assignment.team_member?.name || 'Unknown'}
                    </h4>
                    <StatusBadge status={assignment.status} />
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1">
                    {assignment.role}
                  </p>

                  {isHighlighted(assignment.id) && (
                    <p className="text-xs text-blue-600 mt-2 font-medium">
                      Please confirm your attendance below
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons for own pending assignments */}
              {isOwnAssignment(assignment) && assignment.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleConfirm(assignment.id)}
                    isDisabled={processing === assignment.id}
                  >
                    Confirm
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDecline(assignment.id)}
                    isDisabled={processing === assignment.id}
                  >
                    Decline
                  </Button>
                </div>
              )}

              {/* Show status for other people's assignments or own confirmed/declined */}
              {!isOwnAssignment(assignment) || assignment.status !== 'pending' ? (
                <div className="text-sm text-gray-500 min-w-[100px] text-right">
                  {assignment.status === 'confirmed' && (
                    <span className="text-green-600">Confirmed</span>
                  )}
                  {assignment.status === 'declined' && (
                    <span className="text-red-600">Declined</span>
                  )}
                  {assignment.status === 'pending' && (
                    <span className="text-gray-500">Pending</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}