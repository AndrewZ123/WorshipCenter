import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface WelcomeEmailRequest {
  userId: string;
  churchId: string;
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
    console.log('[Welcome Email] Starting request');
    
    let body: WelcomeEmailRequest;
    try {
      body = await request.json();
      console.log('[Welcome Email] Request body:', { userId: body.userId, churchId: body.churchId });
    } catch (parseError) {
      console.error('[Welcome Email] Failed to parse request body:', parseError);
      return jsonResponse(
        { 
          error: 'Invalid request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        }, 
        400
      );
    }

    const { userId, churchId } = body;

    if (!userId || !churchId) {
      console.error('[Welcome Email] Missing required fields:', { userId, churchId });
      return jsonResponse({ error: 'userId and churchId are required' }, 400);
    }

    // Fetch user and church information
    let userResult, churchResult;
    try {
      console.log('[Welcome Email] Fetching user and church data');
      [userResult, churchResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('churches').select('*').eq('id', churchId).single(),
      ]);
    } catch (dbError) {
      console.error('[Welcome Email] Database query error:', dbError);
      return jsonResponse(
        { 
          error: 'Database query failed', 
          details: String(dbError) 
        },
        500
      );
    }

    if (userResult.error || !userResult.data) {
      console.error('[Welcome Email] User fetch error:', userResult.error);
      return jsonResponse(
        { error: 'Failed to fetch user', details: userResult.error?.message },
        404
      );
    }

    if (churchResult.error || !churchResult.data) {
      console.error('[Welcome Email] Church fetch error:', churchResult.error);
      return jsonResponse(
        { error: 'Failed to fetch church', details: churchResult.error?.message },
        404
      );
    }

    const user = userResult.data;
    const church = churchResult.data;
    const adminName = user.name;
    const churchName = church.name;
    const userEmail = user.email;

    // Send welcome email using Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[Welcome Email] RESEND_API_KEY not configured');
      return jsonResponse(
        { error: 'Email service not configured (RESEND_API_KEY missing in environment variables)' },
        500
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    let emailResponse;
    try {
      console.log('[Welcome Email] Sending email via Resend API to:', userEmail);
      emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'WorshipCenter <welcome@worshipcenter.app>',
          to: [userEmail],
          subject: `Welcome to WorshipCenter at ${churchName}!`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to WorshipCenter</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f5f5f5;
                  }
                  .container {
                    background-color: white;
                    border-radius: 12px;
                    padding: 40px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  }
                  .header {
                    text-align: center;
                    margin-bottom: 30px;
                  }
                  .logo {
                    font-size: 24px;
                    font-weight: 800;
                    color: #0d9488;
                    margin-bottom: 10px;
                  }
                  .logo span {
                    color: #333;
                  }
                  h1 {
                    color: #333;
                    font-size: 24px;
                    margin-bottom: 20px;
                  }
                  .message {
                    font-size: 16px;
                    color: #666;
                    margin-bottom: 30px;
                    line-height: 1.8;
                  }
                  .button {
                    display: inline-block;
                    background-color: #0d9488;
                    color: white;
                    text-decoration: none;
                    padding: 14px 28px;
                    border-radius: 8px;
                    font-weight: 600;
                    margin: 20px 0;
                  }
                  .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    text-align: center;
                    font-size: 12px;
                    color: #999;
                  }
                  .footer a {
                    color: #0d9488;
                    text-decoration: none;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <div class="logo">Worship<span>Center</span></div>
                  </div>
                  
                  <h1>Welcome to WorshipCenter! 🎵</h1>
                  
                  <p class="message">
                    Hey ${adminName},
                    <br><br>
                    Welcome to WorshipCenter at <strong>${churchName}</strong>!
                    <br><br>
                    Your church account is now set up and ready to go. You can start planning services, managing your song library, and scheduling your team right away.
                  </p>
                  
                  <div style="text-align: center;">
                    <a href="${appUrl}/dashboard" class="button">Go to Dashboard</a>
                  </div>
                  
                  <p class="message">
                    <strong>Getting Started:</strong>
                    <br>
                    • Create your first service plan<br>
                    • Add songs to your library<br>
                    • Invite team members to help out
                  </p>
                  
                  <p class="message">
                    If you have any questions or need help, just reply to this email. We're here for you!
                  </p>
                  
                  <div class="footer">
                    <p>WorshipCenter - Making worship planning easy</p>
                    <p>
                      <a href="${appUrl}">Visit Website</a> • 
                      <a href="mailto:support@worshipcenter.app">Contact Support</a>
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `,
        }),
      });
    } catch (fetchError) {
      console.error('[Welcome Email] Fetch error when calling Resend API:', fetchError);
      return jsonResponse(
        { 
          error: 'Failed to send welcome email', 
          details: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error' 
        },
        500
      );
    }

    if (!emailResponse.ok) {
      let errorText = 'Unknown error';
      try {
        errorText = await emailResponse.text();
      } catch (e) {
        console.error('[Welcome Email] Could not parse error response');
      }
      console.error('[Welcome Email] Resend API error:', errorText);
      console.error('[Welcome Email] Resend API status:', emailResponse.status);
      return jsonResponse(
        { 
          error: 'Failed to send welcome email', 
          details: errorText,
          statusCode: emailResponse.status 
        },
        500
      );
    }

    console.log('[Welcome Email] Successfully sent welcome email to:', userEmail);

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[Welcome Email] Unhandled error:', error);
    console.error('[Welcome Email] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[Welcome Email] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      constructor: error instanceof Error ? error.constructor.name : 'Unknown'
    });
    return jsonResponse(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      500
    );
  }
}