import Mailgun from 'mailgun.js';
import formData from 'form-data';

const mailgun = new Mailgun(formData);

let mg = null;

const getClient = () => {
    if (!mg) {
        const apiKey = process.env.MAILGUN_API_KEY;
        if (!apiKey) {
            console.warn('[EMAIL] MAILGUN_API_KEY is not configured.');
            return null;
        }
        mg = mailgun.client({
            username: 'api',
            key: apiKey,
        });
    }
    return mg;
};

/**
 * Sends an email to the administrator via Mailgun.
 * @param {string} subject - Email subject
 * @param {string} text - Email body (plain text)
 * @param {string} html - Email body (HTML)
 */
export const sendAdminEmail = async (subject, text, html = '') => {
    try {
        const domain = process.env.MAILGUN_DOMAIN;
        const adminEmail = process.env.ADMIN_EMAIL;
        const fromEmail = process.env.MAILGUN_FROM || `MedFlow Alert <noreply@${domain}>`;

        if (!domain || !adminEmail) {
            console.warn('[EMAIL] Skipping email: MAILGUN_DOMAIN or ADMIN_EMAIL is not configured in .env.');
            return;
        }

        const client = getClient();
        if (!client) return;

        const msg = await client.messages.create(domain, {
            from: fromEmail,
            to: [adminEmail],
            subject: subject,
            text: text,
            html: html || text,
        });

        console.log(`[EMAIL] Mailgun alert sent to Admin: ${msg.id}`);
    } catch (error) {
        console.error('[EMAIL] Mailgun error:', error.message || error);
    }
};
