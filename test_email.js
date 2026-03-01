import dotenv from 'dotenv';
dotenv.config();

import { sendAdminEmail } from './src/services/emailService.js';

console.log('MAILGUN_API_KEY:', process.env.MAILGUN_API_KEY ? '✅ Set' : '❌ NOT SET');
console.log('MAILGUN_DOMAIN:', process.env.MAILGUN_DOMAIN ? '✅ Set' : '❌ NOT SET');

// Try sending
await sendAdminEmail('Test from HackFusion', 'Hi, this is a test email!', '<h1>Hi!</h1><p>This is a test email from MedFlow.</p>');

console.log('Done.');
