const fs = require('fs');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:tOSfHZUNDzAhXKek@db.ehvufyzculaouvittvve.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    const sql = fs.readFileSync('supabase/master_schema.sql', 'utf8');
    console.log("Read master_schema.sql, executing...");
    
    await client.query(sql);
    console.log("Execution successful!");
  } catch (err) {
    console.error("Error executing schema:", err);
  } finally {
    await client.end();
  }
}

run();
