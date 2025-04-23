require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.DB_URL;
const supabaseKey = process.env.DB_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Parameters
const keyType = process.argv[2] || 'standard'; // Can be 'standard' or 'admin'
const keyName = process.argv[3] || 'API Key ' + new Date().toISOString();
const rateLimit = process.argv[4] || 100; // Requests per day

// Generate a new API key
const generateKey = async () => {
  try {
    // Generate a UUID v4 for the key
    const apiKey = `sk-${uuidv4().replace(/-/g, '')}`;
    
    // Hash the key with bcrypt for storage
    const salt = await bcrypt.genSalt(10);
    const hashedKey = await bcrypt.hash(apiKey, salt);
    
    // Store in Supabase
    const { data, error } = await supabase
      .from('api_keys')
      .insert([
        { 
          name: keyName,
          key_hash: hashedKey,
          type: keyType,
          rate_limit: rateLimit,
          created_at: new Date().toISOString()
        }
      ]);
    
    if (error) {
      console.error('Error storing key:', error);
      return;
    }
    
    console.log('=== NEW API KEY GENERATED ===');
    console.log(`API Key: ${apiKey}`);
    console.log(`Name: ${keyName}`);
    console.log(`Type: ${keyType}`);
    console.log(`Rate Limit: ${rateLimit} requests per day`);
    console.log('=============================');
    console.log('IMPORTANT: Store this key safely. It will not be displayed again.');
    
  } catch (err) {
    console.error('Error generating key:', err);
  }
};

generateKey(); 