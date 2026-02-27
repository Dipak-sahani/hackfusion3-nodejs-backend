import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY').trim();

if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseKey === 'YOUR_SUPABASE_KEY') {
    console.warn('⚠️ Supabase credentials not fully configured in .env. Uploads will fail.');
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
    console.log(`✅ Using Supabase SERVICE_ROLE_KEY (Length: ${key.length}, Starts with: ${key.substring(0, 5)}...)`);
} else {
    console.warn('⚠️ Using Supabase ANON_KEY (RLS may block uploads if not configured correctly)');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
