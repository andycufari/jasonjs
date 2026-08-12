// core/services/email.js - Comprehensive Email Service
import nodemailer from 'nodemailer';
import jasonConfig from '../../jason.config';
import { getEnv } from '../sites/files.js';
import { getTheme } from '../render/getTheme.js';

/**
 * Create email transporter based on environment configuration (legacy)
 */
function createTransporter() {
  // Check if email configuration is available
  if (!process.env.EMAIL_SERVER_HOST || !process.env.EMAIL_SERVER_USER) {
    console.warn('Email configuration not found - emails will be logged only');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: parseInt(process.env.EMAIL_SERVER_PORT) || 587,
    secure: process.env.EMAIL_SERVER_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD
    }
  });
}

/**
 * Email Service Class
 * Handles email sending with template support and theme integration
 */
class EmailService {
  constructor() {
    this.transporters = new Map(); // Cache transporters per domain
  }

  /**
   * Get or create SMTP transporter for a domain
   * @param {string} domain - Domain identifier
   * @returns {Promise<Object>} Nodemailer transporter
   */
  async getTransporter(domain) {
    // Check cache
    if (this.transporters.has(domain)) {
      return this.transporters.get(domain);
    }

    // Load SMTP configuration from site-specific env first, then fallback to global process.env
    const host = await getEnv(domain, 'EMAIL_SERVER_HOST') || process.env.EMAIL_SERVER_HOST;
    const port = await getEnv(domain, 'EMAIL_SERVER_PORT') || process.env.EMAIL_SERVER_PORT;
    const user = await getEnv(domain, 'EMAIL_SERVER_USER') || process.env.EMAIL_SERVER_USER;
    const password = await getEnv(domain, 'EMAIL_SERVER_PASSWORD') || process.env.EMAIL_SERVER_PASSWORD;

    if (!host || !port || !user || !password) {
      throw new Error('Email service not configured. Missing SMTP credentials in environment.');
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465, // true for 465, false for other ports
      auth: {
        user,
        pass: password,
      },
    });

    // Verify connection
    try {
      await transporter.verify();
      console.log(`✅ Email transporter ready for ${domain}`);
    } catch (error) {
      console.error(`❌ Email transporter verification failed for ${domain}:`, error.message);
      throw new Error('Failed to connect to email server');
    }

    // Cache transporter
    this.transporters.set(domain, transporter);

    return transporter;
  }

  /**
   * Generate iCal event string from event data
   * @param {Object} eventData - Event information
   * @param {string} eventData.uid - Unique event identifier (auto-generated if not provided)
   * @param {string} eventData.start - Event start time (ISO 8601 format)
   * @param {string} eventData.end - Event end time (ISO 8601 format)
   * @param {string} eventData.summary - Event title/summary
   * @param {string} eventData.description - Event description
   * @param {string} eventData.location - Event location
   * @param {string} eventData.organizer - Organizer email
   * @param {Array<string>} eventData.attendees - Array of attendee emails
   * @param {string} eventData.method - Calendar method: REQUEST, CANCEL, REPLY (default: REQUEST)
   * @param {string} eventData.status - Event status: CONFIRMED, TENTATIVE, CANCELLED (default: CONFIRMED)
   * @param {string} eventData.url - Event URL
   * @returns {Object} iCal event object for nodemailer
   */
  generateICalEvent(eventData) {
    const {
      uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@jasonjs.com`,
      start,
      end,
      summary,
      description = '',
      location = '',
      organizer,
      attendees = [],
      method = 'REQUEST',
      status = 'CONFIRMED',
      url = ''
    } = eventData;

    if (!start || !end || !summary) {
      throw new Error('Calendar event requires start, end, and summary');
    }

    // Convert ISO 8601 to iCal format (YYYYMMDDTHHMMSSZ)
    const formatICalDate = (isoDate) => {
      const date = new Date(isoDate);
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startFormatted = formatICalDate(start);
    const endFormatted = formatICalDate(end);
    const dtstamp = formatICalDate(new Date().toISOString());

    // Build attendee lines
    const attendeeLines = attendees
      .map(email => `ATTENDEE;RSVP=TRUE;ROLE=REQ-PARTICIPANT:mailto:${email}`)
      .join('\n');

    // Build iCal content
    const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//JasonJS Framework//Email Service//EN
METHOD:${method}
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART:${startFormatted}
DTEND:${endFormatted}
SUMMARY:${summary}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
${location ? `LOCATION:${location}` : ''}
${organizer ? `ORGANIZER:mailto:${organizer}` : ''}
${attendeeLines}
STATUS:${status}
SEQUENCE:0
${url ? `URL:${url}` : ''}
END:VEVENT
END:VCALENDAR`;

    return {
      method: method,
      content: icalContent
    };
  }

  /**
   * Convert plain text to HTML with proper paragraph and line break handling
   * @param {string} text - Plain text content
   * @returns {string} HTML content
   */
  textToHtml(text) {
    // Split by double line breaks (paragraphs)
    const paragraphs = text.split(/\n\n+/);

    return paragraphs
      .map(para => {
        const trimmed = para.trim();
        if (!trimmed) return '';

        // Check if this is a numbered list (1. 2. 3. etc)
        const lines = trimmed.split(/\n/);
        const isNumberedList = lines.every(line => /^\d+\.\s/.test(line.trim()));

        if (isNumberedList) {
          // Convert to HTML ordered list
          const listItems = lines
            .map(line => {
              const content = line.replace(/^\d+\.\s/, '').trim();
              return `<li style="color: inherit; margin-bottom: 8px;">${content}</li>`;
            })
            .join('\n');
          return `<ol style="margin: 16px 0; padding-left: 20px; color: inherit;">\n${listItems}\n</ol>`;
        }

        // Check if this is a bulleted list (- or *)
        const isBulletList = lines.every(line => /^[-*]\s/.test(line.trim()));

        if (isBulletList) {
          // Convert to HTML unordered list
          const listItems = lines
            .map(line => {
              const content = line.replace(/^[-*]\s/, '').trim();
              return `<li style="color: inherit; margin-bottom: 8px;">${content}</li>`;
            })
            .join('\n');
          return `<ul style="margin: 16px 0; padding-left: 20px; color: inherit;">\n${listItems}\n</ul>`;
        }

        // Regular paragraph - replace single line breaks with <br>
        const formatted = trimmed.replace(/\n/g, '<br>');
        return `<p style="color: inherit;">${formatted}</p>`;
      })
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Convert markdown to HTML
   * @param {string} markdown - Markdown content
   * @returns {string} HTML content
   */
  markdownToHtml(markdown) {
    // Simple markdown to HTML conversion
    // For production, consider using a library like 'marked' or 'markdown-it'
    return markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
      // Line breaks
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>')
      // Wrap in paragraph
      .replace(/^(.*)$/gim, '<p>$1</p>');
  }

  /**
   * Generate themed email template
   * @param {string} body - HTML body content
   * @param {Object} theme - Theme configuration
   * @param {Object} options - Template options
   * @returns {string} Complete HTML email
   */
  generateTemplate(body, theme = {}, options = {}) {
    const {
      title = '',
      preheader = '',
      footerText = jasonConfig.email.footerText,
      footerLink = jasonConfig.email.footerLink,
      hideFooter = false
    } = options;

    // Get theme or use defaults
    const { mergedTheme } = getTheme(theme);
    const colors = mergedTheme.colors || {};

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${title ? `<title>${title}</title>` : ''}
  ${preheader ? `<meta name="description" content="${preheader}">` : ''}
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: ${colors.text || '#1e293b'};
      background-color: ${colors.background || '#f8fafc'};
    }
    .email-wrapper {
      width: 100%;
      background-color: ${colors.background || '#f8fafc'};
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      min-width: 320px;
      margin: 0 auto;
      background-color: ${colors.surface || '#ffffff'};
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      width: 100%;
    }
    .email-header {
      background: linear-gradient(135deg, ${colors.primary || '#6366f1'}, ${colors.secondary || '#8b5cf6'});
      padding: 40px 30px;
      text-align: center;
    }
    .email-header h1 {
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      margin: 0;
    }
    .email-body {
      padding: 40px 30px;
      color: ${colors.text || '#1e293b'};
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .email-body h1,
    .email-body h2,
    .email-body h3 {
      color: ${colors.primary || '#6366f1'};
      margin-top: 20px;
      margin-bottom: 10px;
    }
    .email-body h1 {
      font-size: 28px;
    }
    .email-body h2 {
      font-size: 24px;
    }
    .email-body h3 {
      font-size: 20px;
    }
    .email-body p {
      margin-bottom: 16px;
      color: ${colors.text || '#1e293b'};
    }
    .email-body ol,
    .email-body ul {
      margin: 16px 0;
      padding-left: 20px;
      color: ${colors.text || '#1e293b'};
    }
    .email-body li {
      margin-bottom: 8px;
      color: ${colors.text || '#1e293b'};
    }
    .email-body a {
      color: ${colors.primary || '#6366f1'};
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-button {
      display: inline-block;
      padding: 12px 30px;
      background-color: ${colors.primary || '#6366f1'};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .email-footer {
      background-color: ${colors.surface || '#f8fafc'};
      padding: 30px;
      text-align: center;
      border-top: 1px solid ${colors.border || '#e2e8f0'};
    }
    .email-footer p {
      color: ${colors.textMuted || '#64748b'};
      font-size: 14px;
      margin: 5px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      .email-container {
        border-radius: 0;
      }
      .email-header,
      .email-body,
      .email-footer {
        padding: 20px 15px;
      }
      .email-body {
        font-size: 15px;
      }
      .email-body ol,
      .email-body ul {
        padding-left: 15px;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
  <div class="email-wrapper">
    <div class="email-container">
      ${title ? `
      <div class="email-header">
        <h1>${title}</h1>
      </div>
      ` : ''}
      <div class="email-body">
        ${body}
      </div>
      ${!hideFooter ? `
      <div class="email-footer">
        <p>
          ${footerLink ? `<a href="${footerLink}" style="color: ${colors.textMuted || '#64748b'}; text-decoration: none;">${footerText}</a>` : footerText}
        </p>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Send email with full template support
   * @param {string} domain - Domain identifier
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async send(domain, options = {}) {
    const {
      to,
      toName,
      from,
      fromName,
      subject,
      body,
      bodyText,
      template,
      theme = {},
      calendarEvent,
      ...extraOptions
    } = options;

    // Validate required fields
    if (!to) {
      throw new Error('Email recipient (to) is required');
    }

    if (!subject) {
      throw new Error('Email subject is required');
    }

    if (!body && !bodyText) {
      throw new Error('Email body or bodyText is required');
    }

    // Get default from address (site-specific or global)
    const defaultFrom = await getEnv(domain, 'EMAIL_FROM') || process.env.EMAIL_FROM;
    const finalFrom = from || defaultFrom;

    if (!finalFrom) {
      throw new Error('Email sender (from) is required. Set EMAIL_FROM environment variable or pass from parameter.');
    }

    // Prepare recipients
    const recipients = Array.isArray(to) ? to : [to];
    const toAddresses = recipients.map((recipient, index) => {
      const name = Array.isArray(toName) ? toName[index] : toName;
      return name ? `"${name}" <${recipient}>` : recipient;
    });

    // Prepare sender
    const fromAddress = fromName ? `"${fromName}" <${finalFrom}>` : finalFrom;

    // Prepare HTML body
    let htmlBody = body;

    // Handle text template - convert plain text to HTML with proper line breaks
    if (template === 'text' && body) {
      htmlBody = this.textToHtml(body);
    }

    // Handle markdown template
    if (template === 'markdown' && body) {
      htmlBody = this.markdownToHtml(body);
    }

    // Handle auto template - wrap in themed template
    if (template === 'auto' || template === 'markdown' || template === 'text') {
      htmlBody = this.generateTemplate(htmlBody, theme, {
        title: extraOptions.title || subject,
        preheader: extraOptions.preheader || '',
        footerText: extraOptions.footerText,
        footerLink: extraOptions.footerLink,
        hideFooter: extraOptions.hideFooter,
      });
    }

    // Prepare email message
    const message = {
      from: fromAddress,
      to: toAddresses.join(', '),
      subject,
      text: bodyText || body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      html: htmlBody,
      ...extraOptions, // Allow additional nodemailer options
    };

    // Add calendar event if provided
    if (calendarEvent) {
      try {
        const icalEvent = this.generateICalEvent(calendarEvent);
        message.icalEvent = icalEvent;

        // Also add as alternative attachment for better email client compatibility
        if (!message.alternatives) {
          message.alternatives = [];
        }
        message.alternatives.push({
          contentType: 'text/calendar; charset=UTF-8; method=' + icalEvent.method,
          content: icalEvent.content
        });
      } catch (error) {
        console.error(`Failed to generate calendar event for ${domain}:`, error.message);
        throw new Error(`Calendar event generation failed: ${error.message}`);
      }
    }

    // Get transporter and send
    try {
      const transporter = await this.getTransporter(domain);
      const info = await transporter.sendMail(message);

      console.log(`✅ Email sent successfully to ${to} for domain ${domain}`);

      return {
        success: true,
        messageId: info.messageId,
        recipients: recipients,
        subject,
        sentAt: new Date().toISOString(),
        domain,
      };
    } catch (error) {
      console.error(`❌ Failed to send email for domain ${domain}:`, error.message);

      return {
        success: false,
        error: error.message,
        recipients: recipients,
        subject,
        domain,
      };
    }
  }

  /**
   * Clear cached transporter for a domain
   * @param {string} domain - Domain identifier
   */
  clearCache(domain) {
    this.transporters.delete(domain);
  }

  /**
   * Clear all cached transporters
   */
  clearAllCaches() {
    this.transporters.clear();
  }
}

// Singleton instance
let emailService = null;

/**
 * Get email service instance
 * @returns {EmailService}
 */
export function getEmailService() {
  if (!emailService) {
    emailService = new EmailService();
  }
  return emailService;
}

/**
 * Send verification code email
 * @param {string} email - Recipient email
 * @param {string} code - 6-digit verification code
 * @param {string} type - 'login' or 'registration'
 * @param {object} siteConfig - Site configuration for branding
 * @param {string} domain - Optional domain for domain-specific email config
 */
export async function sendVerificationCode(email, code, type = 'login', siteConfig = {}, domain = null) {
  // Try to use domain-specific configuration if domain is provided
  let transporter;

  if (domain) {
    try {
      const emailService = getEmailService();
      transporter = await emailService.getTransporter(domain);
    } catch (error) {
      console.warn(`Failed to get domain-specific transporter for ${domain}, falling back to global config:`, error.message);
      transporter = createTransporter();
    }
  } else {
    // Fall back to global configuration
    transporter = createTransporter();
  }

  // If no transporter (no email config), just log the code
  if (!transporter) {
    console.log(`[EMAIL SIMULATION] Verification code for ${email}: ${code} (${type})`);
    return { success: true, simulated: true };
  }

  const siteName = siteConfig.name || 'JasonJS Framework';
  const isLogin = type === 'login';

  const subject = isLogin ?
    `Your login code for ${siteName}` :
    `Verify your email for ${siteName}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin: 0; font-weight: 600;">
            ${siteName}
          </h1>
        </div>

        <!-- Main Content -->
        <div style="text-align: center; margin-bottom: 40px;">
          <h2 style="color: #333; font-size: 20px; margin-bottom: 16px;">
            ${isLogin ? 'Your Login Code' : 'Verify Your Email'}
          </h2>

          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">
            ${isLogin ?
              'Use this code to sign in to your account:' :
              'Use this code to verify your email and complete your registration:'
            }
          </p>

          <!-- Verification Code -->
          <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
            <div style="font-size: 32px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 4px; color: #1a1a1a;">
              ${code}
            </div>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            This code expires in 15 minutes for security.
          </p>
        </div>

        <!-- Security Notice -->
        <div style="background-color: #f8f9fa; border-radius: 6px; padding: 16px; margin-bottom: 32px;">
          <p style="color: #666; font-size: 13px; margin: 0; line-height: 1.4;">
            🔒 <strong>Important:</strong> Never share this code with anyone.
            ${siteName} will never ask for this code by phone or email.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; border-top: 1px solid #e9ecef; padding-top: 24px;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            This email was sent to ${email}. If you didn't request this code, you can safely ignore this message.
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  const textContent = `
${siteName}

${isLogin ? 'Your Login Code' : 'Verify Your Email'}

${isLogin ?
  'Use this code to sign in to your account:' :
  'Use this code to verify your email:'
}

Verification code: ${code}

This code expires in 15 minutes.

Never share this code with anyone. ${siteName} will never ask for this code by phone or email.

---
This email was sent to ${email}.
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${siteName}" <${process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER}>`,
      to: email,
      subject: subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`Verification email sent to ${email} (${type}): ${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error(`Failed to send verification email to ${email}:`, error);

    // Fallback: log the code if email sending fails
    console.log(`[EMAIL FALLBACK] Verification code for ${email}: ${code} (${type})`);

    return { success: false, error: error.message, fallbackLogged: true };
  }
}

export default {
  sendVerificationCode,
  getEmailService
};