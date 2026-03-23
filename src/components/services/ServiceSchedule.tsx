'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import type { Service, ServiceAssignmentPopulated } from '@/lib/types';
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

  if (assignments.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No team members scheduled</h3>
        <p className="mt-1 text-sm text-gray-500">
          Add team members to the schedule to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Team Schedule</h3>
        <p className="text-sm text-gray-500">
          {formatServiceDate(service.date, service.time)}
        </p>
      </div>

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