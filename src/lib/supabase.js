const { createClient } = require('@supabase/supabase-js');

// Service role client — full database access, used only on the backend
// Never expose the service role key to the mobile app
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
