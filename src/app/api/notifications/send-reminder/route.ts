import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';

interface SendReminderRequest {
  serviceId: string;
  churchId: string;
  serviceTitle: string;
  serviceDate: string;
  serviceTime: string;
}

/**
 * Helper function to create JSON response with explicit Content-Type header
 */
function jsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Send Reminder] Starting request');
    
    let body: SendReminderRequest;
    try {
      body = await request.json();
      console.log('[Send Reminder] Request body:', body);
    } catch (parseError) {
      console.error('[Send Reminder] Failed to parse request body:', parseError);
      return jsonResponse(
        { 
          error: 'Invalid request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        }, 
        400
      );
    }

    const { serviceId, churchId, serviceTitle, serviceDate, serviceTime } = body;

    if (!serviceId || !churchId) {
      console.error('[Send Reminder] Missing required fields:', { serviceId, churchId });
      return jsonResponse({ error: 'serviceId and churchId are required' }, 400);
    }

    // Get church details
    let church;
    try {
      console.log('[Send Reminder] Fetching church:', churchId);
      church = await db.churches.getById(churchId);
      if (!church) {
        console.warn('[Send Reminder] Church not found');
        return jsonResponse({ error: 'Church not found' }, 404);
      }
      console.log('[Send Reminder] Church found:', church.name);
    } catch (dbError) {
      console.error('[Send Reminder] Database error fetching church:', dbError);
      return jsonResponse(
        { 
          error: 'Database error fetching church', 
          details: String(dbError) 
        }, 
        500
      );
    }

    // Get all team members assigned to this service
    let assignments;
    try {
      console.log('[Send Reminder] Fetching assignments for service:', serviceId);
      assignments = await db.assignments.getByService(serviceId, churchId);
    } catch (dbError) {
      console.error('[Send Reminder] Database error fetching assignments:', dbError);
      return jsonResponse(
        { 
          error: 'Database error fetching assignments', 
          details: String(dbError) 
        }, 
        500
      );
    }
    
    if (!assignments || assignments.length === 0) {
      console.log('[Send Reminder] No team members to remind');
      return jsonResponse({ 
        success: true, 
        message: 'No team members to remind',
        emailsSent: 0,
      });
    }

    console.log('[Send Reminder] Processing', assignments.length, 'assignments');

    // Fetch team member details for all assignments
    const teamMembers = await Promise.all(
      assignments.map(async (assignment) => {
        const member = await db.teamMembers.getById(assignment.team_member_id, churchId);
        return {
          member,
          role: assignment.role,
          status: assignment.status,
        };
      })
    );

    // Send reminders to confirmed team members
    let emailsSent = 0;
    for (const { member, role, status } of teamMembers) {
      if (!member || !member.email || status !== 'confirmed') {
        continue; // Skip if no email or not confirmed
      }

      // Format the role for display
      const formattedRole = role.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      // Create notification record
      try {
        await db.notifications.create({
          church_id: churchId,
          user_id: '', // Team members may not have user accounts
          type: 'service_reminder',
          title: `Service Reminder: ${serviceTitle}`,
          message: `Reminder: You're serving as ${formattedRole} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}`,
          service_id: serviceId,
          read: false,
        });
      } catch (notificationError) {
        console.error('[Send Reminder] Error creating notification:', notificationError);
        // Continue processing even if notification creation fails
      }

      // In a production environment, you would send an actual email here
      console.log('[Send Reminder] Reminder email would be sent to:', member.email);
      console.log('[Send Reminder] Subject:', `Service Reminder: ${serviceTitle}`);
      console.log('[Send Reminder] Body:', `
        Hi ${member.name},
        
        This is a friendly reminder that you're serving as ${formattedRole} for ${serviceTitle} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}.
        
        Thanks,
        ${church.name}
      `);

      emailsSent++;
    }

    console.log('[Send Reminder] Successfully processed', emailsSent, 'reminders');

    return jsonResponse({ 
      success: true, 
      emailsSent,
    });
  } catch (error) {
    console.error('[Send Reminder] Unhandled error:', error);
    console.error('[Send Reminder] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[Send Reminder] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      constructor: error instanceof Error ? error.constructor.name : 'Unknown'
    });
    return jsonResponse(
      { 
        error: 'Failed to send reminders', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      500
    );
  }
}