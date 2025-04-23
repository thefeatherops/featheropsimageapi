const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.DB_URL;
const supabaseKey = process.env.DB_KEY;

// Check if environment variables are set
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please check your environment variables.');
  process.exit(1);
}

// Create a single Supabase client for interacting with your database
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase; 