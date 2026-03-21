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

export async function POST(request: NextRequest) {
  try {
    const body: SendReminderRequest = await request.json();
    const { serviceId, churchId, serviceTitle, serviceDate, serviceTime } = body;

    // Get church details
    const church = await db.churches.getById(churchId);
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    // Get all team members assigned to this service
    const assignments = await db.assignments.getByService(serviceId, churchId);
    
    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No team members to remind',
        emailsSent: 0,
      });
    }

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
      await db.notifications.create({
        church_id: churchId,
        user_id: '', // Team members may not have user accounts
        type: 'service_reminder',
        title: `Service Reminder: ${serviceTitle}`,
        message: `Reminder: You're serving as ${formattedRole} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}`,
        service_id: serviceId,
        read: false,
      });

      // In a production environment, you would send an actual email here
      console.log('[Email Service] Reminder email would be sent to:', member.email);
      console.log('[Email Service] Subject:', `Service Reminder: ${serviceTitle}`);
      console.log('[Email Service] Body:', `
        Hi ${member.name},
        
        This is a friendly reminder that you're serving as ${formattedRole} for ${serviceTitle} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}.
        
        Thanks,
        ${church.name}
      `);

      emailsSent++;
    }

    return NextResponse.json({ 
      success: true, 
      emailsSent,
    });
  } catch (error) {
    console.error('[Send Reminder] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    );
  }
}