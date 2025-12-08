const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.hotayjvzbdjdkdhucrur:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres'.replace('[YOUR-PASSWORD]', 'nip-cuts1BALDRICK7have');

async function run() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/0011_create_users_table.sql'), 'utf8');
        console.log('Running migration...');
        await client.query(sql);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

run();
