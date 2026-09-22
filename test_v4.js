const fs = require('fs');
const sql = fs.readFileSync('LOCAL_MYSQL_SCHEMA_MIGRATION_V4.sql', 'utf8');
const tables = sql.split('CREATE TABLE').filter(Boolean);
console.log('Tables:', tables.length - 1);
const alters = sql.split('ALTER TABLE').filter(Boolean);
console.log('Alters:', alters.length - 1);
const fks = sql.split('FOREIGN KEY').filter(Boolean);
console.log('FKs:', fks.length - 1);
