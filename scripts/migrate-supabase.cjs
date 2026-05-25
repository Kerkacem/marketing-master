const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://llklgbevvexnjtotibtj.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsa2xnYmV2dmV4bmp0b3RpYnRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY2NDUyOSwiZXhwIjoyMDk1MjQwNTI5fQ.0lz5FUh2k8Xz14Sv_VoaD6Qoh9pN6hgi2AnsdMpqm_s';

async function runMigration() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migration.sql'), 'utf-8');

  // Split by CREATE TABLE statements
  const statements = sql.split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s.toUpperCase().includes('CREATE TABLE'));

  console.log(`عدد جداول للإنشاء: ${statements.length}`);

  for (const stmt of statements) {
    const tableNameMatch = stmt.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
    const tableName = tableNameMatch ? tableNameMatch[1] : '?';

    try {
      // Use the SQL query via Supabase's REST API
      // We need to use the Management API endpoint
      const response = await fetch(`https://api.supabase.com/v1/projects/llklgbevvexnjtotibtj/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: stmt + ';' })
      });

      if (response.ok) {
        console.log(`✅ ${tableName}`);
      } else {
        const err = await response.json();
        if (err.message && err.message.includes('already exists')) {
          console.log(`⏭️  ${tableName} موجود مسبقاً`);
        } else {
          console.log(`❌ ${tableName}: ${err.message || JSON.stringify(err)}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${tableName}: ${err.message}`);
    }
  }

  // Verify
  const verifyResp = await fetch(`https://api.supabase.com/v1/projects/llklgbevvexnjtotibtj/database/query`, {
    method: 'POST', headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name" })
  });

  if (verifyResp.ok) {
    const tables = await verifyResp.json();
    console.log('\n📊 الجداول:', tables.map(t => t.table_name).join(', '));
  }

  console.log('\n🎉 تم!');
}

runMigration();
