import nodemailer from 'nodemailer';

// Helper to get transporter
const getTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail', // You can change this or make it configurable
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

/**
 * Sends an email to the administrator.
 * @param {string} subject - Email subject
 * @param {string} text - Email body (plain text)
 * @param {string} html - Email body (HTML)
 */
export const sendAdminEmail = async (subject, text, html = '') => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !adminEmail) {
            console.warn('[EMAIL] Skipping email send: EMAIL_USER, EMAIL_PASS, or ADMIN_EMAIL is not configured in .env.');
            return;
        }

        const transporter = getTransporter();

        const mailOptions = {
            from: `"MedFlow Alert" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            subject: subject,
            text: text,
            html: html || text // Fallback to text if HTML not provided
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Alert sent to Admin: ${info.response}`);
    } catch (error) {
        console.error('[EMAIL] Error sending admin email:', error);
    }
};
