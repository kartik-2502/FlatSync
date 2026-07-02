import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Local log file path for development auditing
const logDirectory = path.join(__dirname, '../../logs');
const logFilePath = path.join(logDirectory, 'emails.log');

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

let transporter: nodemailer.Transporter | null = null;

// Initialize mail transporter async
async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (host && port && user && pass) {
    // User configured SMTP
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: { user, pass }
    });
    console.log(`Email Service: Configured with SMTP host ${host}`);
  } else {
    try {
      // Create Ethereal test account automatically for local development
      console.log('Email Service: Generating Ethereal test email account...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`Email Service: Ethereal SMTP account created. User: ${testAccount.user}`);
    } catch (error) {
      console.error('Failed to create Ethereal SMTP transporter, falling back to mock logger:', error);
      // Create a dummy mock transporter that just returns success
      transporter = {
        sendMail: async (mailOptions: any) => {
          return { messageId: 'mock-id-' + Date.now() };
        }
      } as unknown as nodemailer.Transporter;
    }
  }

  return transporter;
}

export async function sendEmailNotification(to: string, subject: string, htmlContent: string, plainText: string) {
  // 1. Log to emails.log file
  const logMessage = `
========================================
[${new Date().toISOString()}]
TO: ${to}
SUBJECT: ${subject}
BODY (Plain):
${plainText}
========================================
`;
  try {
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
  } catch (err) {
    console.error('Failed to write to emails.log:', err);
  }

  // 2. Log to console
  console.log(`\n📧 EMAIL NOTIFICATION TO: ${to}`);
  console.log(`📧 SUBJECT: ${subject}`);
  console.log(`📧 BODY:\n${plainText}\n`);

  // 3. Send actual email
  try {
    const currentTransporter = await getTransporter();
    const info = await currentTransporter.sendMail({
      from: '"FlatSync" <noreply@flatsync.com>',
      to,
      subject,
      text: plainText,
      html: htmlContent
    });

    // If using Ethereal, print the test email preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 Test Email Preview URL: ${previewUrl}`);
      try {
        fs.appendFileSync(logFilePath, `PREVIEW URL: ${previewUrl}\n========================================\n`, 'utf8');
      } catch (_) {}
    }
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

export async function sendInterestEmailToOwner(
  ownerEmail: string,
  ownerName: string,
  tenantName: string,
  compatibilityScore: number,
  explanation: string,
  location: string
) {
  const subject = `🔥 High Compatibility Match: Tenant interested in your room in ${location}`;
  const plainText = `Hi ${ownerName},\n\nGood news! A highly compatible tenant, ${tenantName}, has expressed interest in your room listing at ${location}.\n\nCompatibility Score: ${compatibilityScore}/100\nReasoning: ${explanation}\n\nPlease log in to your FlatSync dashboard to view their profile and accept or decline their interest.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #6366f1;">High Compatibility Match!</h2>
      <p>Hi ${ownerName},</p>
      <p>A highly compatible tenant, <strong>${tenantName}</strong>, has expressed interest in your listing at <strong>${location}</strong>.</p>
      <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #10b981;">Compatibility: ${compatibilityScore}/100</h3>
        <p style="margin-bottom: 0; color: #475569; font-style: italic;">"${explanation}"</p>
      </div>
      <p>Please log in to your dashboard to review their full profile and connect.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">FlatSync Inc.</p>
    </div>
  `;

  await sendEmailNotification(ownerEmail, subject, html, plainText);
}

export async function sendInterestResponseToTenant(
  tenantEmail: string,
  tenantName: string,
  ownerName: string,
  location: string,
  status: 'ACCEPTED' | 'DECLINED'
) {
  const isAccepted = status === 'ACCEPTED';
  const subject = isAccepted 
    ? `🎉 Good news! ${ownerName} accepted your interest in ${location}`
    : `Update on your interest in ${location}`;

  const statusText = isAccepted 
    ? `has accepted your interest in the room listing at ${location}. You can now start chatting with them in real-time using the Chat section in your dashboard!`
    : `has declined your interest in the room listing at ${location}. Don't worry, there are plenty of other rooms to explore!`;

  const plainText = `Hi ${tenantName},\n\nWe have an update regarding your interest request for the room listing at ${location}.\n\nOwner ${ownerName} ${statusText}\n\nBest of luck,\nFlatSync Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: ${isAccepted ? '#6366f1' : '#64748b'};">${isAccepted ? 'Interest Request Accepted!' : 'Interest Request Update'}</h2>
      <p>Hi ${tenantName},</p>
      <p>We have an update regarding your interest request for the room listing at <strong>${location}</strong>.</p>
      <p>Owner <strong>${ownerName}</strong> ${statusText}</p>
      ${isAccepted ? '<div style="margin: 20px 0;"><a href="http://localhost:5173" style="background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Chat Now</a></div>' : ''}
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">FlatSync Inc.</p>
    </div>
  `;

  await sendEmailNotification(tenantEmail, subject, html, plainText);
}
