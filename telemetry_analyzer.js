// telemetry_analyzer.js
import sqlite3 from 'sqlite3';
import path from 'path';

const dbFile = path.resolve('./swarm_telemetry.db');
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Data matrix connection failed:', err.message);
    process.exit(1);
  }
});

console.log(`📊 SWARM METRICS REPORTING CORE // VERIFICATION TERMINAL`);
console.log(`==================================================================`);

db.serialize(() => {
  // 1. Calculate Grand Total Volume
  db.get(`SELECT COUNT(*) as total FROM system_logs`, [], (err, row) => {
    if (err) return console.error(err.message);
    console.log(`📈 Total Telemetry Entries Logged: ${row.total}`);
  });

  // 2. Break down entries by type (Success, Warning, Info, Error)
  db.all(`SELECT log_type, COUNT(*) as count FROM system_logs GROUP BY log_type`, [], (err, rows) => {
    if (err) return console.error(err.message);
    console.log(`\n📋 Log Status Breakdown:`);
    rows.forEach(row => {
      const typeStr = `  - [${row.log_type.toUpperCase()}]`.padEnd(16);
      console.log(`${typeStr}: ${row.count} records`);
    });
  });

  // 3. Identify Top Performing Node Targets
  db.all(`SELECT source, COUNT(*) as actions FROM system_logs WHERE source != 'SYSTEM' AND source != 'ROUTER' GROUP BY source ORDER BY actions DESC LIMIT 5`, [], (err, rows) => {
    if (err) return console.error(err.message);
    console.log(`\n🤖 Top 5 Active Swarm Nodes (By Telemetry Throughput):`);
    if (rows.length === 0) console.log("  No node records found yet.");
    rows.forEach((row, i) => {
      console.log(`  ${i + 1}. Agent ID: ${row.source.padEnd(14)} | Commits to Disk: ${row.actions}`);
    });
  });

  // 4. Print Recent Audit Trail Sample
  db.all(`SELECT timestamp, source, message, log_type FROM system_logs ORDER BY id DESC LIMIT 5`, [], (err, rows) => {
    if (err) return console.error(err.message);
    console.log(`\n🔍 Last 5 Telemetry Pipe Commit Logs:`);
    rows.forEach(row => {
      console.log(`  [${row.timestamp}] [${row.source}] (${row.log_type}): ${row.message}`);
    });
    
    // Safely exit once execution arrays finish compiling
    console.log(`==================================================================`);
    db.close();
  });
});