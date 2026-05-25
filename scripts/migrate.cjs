const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

async function resolveHost() {
  return new Promise((resolve, reject) => {
    dns.resolve6('db.llklgbevvexnjtotibtj.supabase.co', (err, addresses) => {
      if (err) {
        // Fallback to A record
        dns.resolve4('db.llklgbevvexnjtotibtj.supabase.co', (err4, addrs4) => {
          if (err4) return reject(err4);
          resolve(addrs4[0]);
        });
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

async function runMigration() {
  try {
    // IPv6 address from DNS (direct since getaddrinfo fails on this network)
    const host = '2a05:d014:1e9b:b302:7e94:f825:8a45:7b81';
    console.log('Using resolved IP:', host);

    const client = new Client({
      host: host,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: '20Mohamed@1987',
      ssl: { rejectUnauthorized: false }
    });

    console.log('جاري الاتصال بقاعدة البيانات...');
    await client.connect();
    console.log('✅ تم الاتصال بنجاح');

    const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migration.sql'), 'utf-8');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i] + ';');
        console.log(`✅ (${i + 1}/${statements.length})`);
      } catch (err) {
        if (err.code === '42P07') {
          console.log(`⏭️  (${i + 1}/${statements.length}) موجود مسبقاً`);
        } else {
          console.error(`❌ (${i + 1}/${statements.length}) ${err.message}`);
        }
      }
    }

    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
    console.log('\n📊 الجداول:', tables.rows.map(t => t.table_name).join(', '));
    console.log('\n🎉 تم بنجاح!');
  } catch (err) {
    console.error('❌', err.message);
  }
}

runMigration();
