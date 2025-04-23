require('dotenv').config();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.DB_URL;
const supabaseKey = process.env.DB_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Parameters
const keyType = process.argv[2] || 'standard'; // Can be 'standard' or 'admin'
const keyName = process.argv[3] || 'API Key ' + new Date().toISOString();
const rateLimit = process.argv[4] || 100; // Requests per day
const ownerEmail = process.argv[5] || 'test@example.com'; // Email of the key owner

// Generate a new API key
const generateKey = async () => {
  try {
    // Generate a key in the correct format
    const keyId = uuidv4().substring(0, 8);
    const apiKey = `feather-ops-apikey-${keyId}`;

    // Hash the key using the same method as in create-test-key.js
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey + process.env.KEY_SALT)
      .digest('hex');

    // Generate a UUID for the record
    const recordId = uuidv4();

    // Store in Supabase
    const { data, error } = await supabase
      .from('keys')
      .insert([
        {
          id: recordId,
          key_hash: keyHash,
          owner_email: ownerEmail,
          rate_limit: rateLimit,
          usage_count: 0,
          created_at: new Date().toISOString(),
          revoked: false
        }
      ])
      .select();

    if (error) {
      console.error('Error storing key:', error);
      return;
    }

    // Also create rate_limits entry like in create-test-key.js
    const { error: rateLimitError } = await supabase
      .from('rate_limits')
      .upsert({
        key_id: recordId,
        requests_count: 0,
        last_reset: new Date().toISOString(),
        max_requests: rateLimit
      });

    if (rateLimitError) {
      console.error('Error creating rate limit entry:', rateLimitError);
    } else {
      console.log('✅ Rate limit entry created successfully!');
    }

    console.log('=== NEW API KEY GENERATED ===');
    console.log(`API Key: ${apiKey}`);
    console.log(`Key ID: ${recordId}`);
    console.log(`Owner: ${ownerEmail}`);
    console.log(`Rate Limit: ${rateLimit} requests per day`);
    console.log('=============================');
    console.log('IMPORTANT: Store this key safely. It will not be displayed again.');
    console.log('\nYou can use this key for API requests:');
    console.log(`Authorization: Bearer ${apiKey}`);

  } catch (err) {
    console.error('Error generating key:', err);
  }
};

generateKey();
