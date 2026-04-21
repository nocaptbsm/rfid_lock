const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. API will run in partially degraded mode or fail.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
