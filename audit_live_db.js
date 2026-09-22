const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'blackboard_user',
  password: 'BlackboardAI2024!',
  database: 'blackboard_ai'
};

const SQL_FILE = '/root/blackboard-ai/LOCAL_MYSQL_SCHEMA_MIGRATION.sql';
const AUDIT_FILE = '/root/blackboard-ai/LOCAL_MYSQL_SCHEMA_AUDIT.md';

// Standard expected schema extracted from codebase
const EXPECTED_TABLES = {
  api_user: { password: 'VARCHAR(128) NOT NULL', is_superuser: 'TINYINT(1) NOT NULL DEFAULT 0', username: 'VARCHAR(150) NOT NULL UNIQUE', first_name: 'VARCHAR(150) DEFAULT ""', last_name: 'VARCHAR(150) DEFAULT ""', is_staff: 'TINYINT(1) NOT NULL DEFAULT 0', is_active: 'TINYINT(1) NOT NULL DEFAULT 1', date_joined: 'DATETIME', email: 'VARCHAR(254) NOT NULL UNIQUE', is_verified: 'TINYINT(1) NOT NULL DEFAULT 0', login_attempts: 'INT NOT NULL DEFAULT 0', role: 'VARCHAR(50)', created_at: 'DATETIME', auth_provider: 'VARCHAR(50)', profile_completed: 'TINYINT(1) NOT NULL DEFAULT 0', google_id: 'VARCHAR(255)', apple_user_id: 'VARCHAR(255)', google_picture_url: 'TEXT', otp_code: 'VARCHAR(10)', otp_expiry: 'DATETIME', last_login: 'DATETIME' },
  api_pendinguser: { email: 'VARCHAR(255) NOT NULL', username: 'VARCHAR(150) NOT NULL', password: 'VARCHAR(128) NOT NULL', full_name: 'VARCHAR(255)', age: 'INT', class_level: 'VARCHAR(50)', exam_board: 'VARCHAR(50)', subject_ids: 'JSON', otp_code: 'VARCHAR(10)', otp_expiry: 'DATETIME', created_at: 'DATETIME' },
  api_userprofile: { user_id: 'INT NOT NULL UNIQUE', full_name: 'VARCHAR(255)', age: 'INT', class_level: 'VARCHAR(50)', exam_board: 'VARCHAR(50)', profile_pic_url: 'TEXT', phone: 'VARCHAR(50)' },
  api_document: { title: 'VARCHAR(255) NOT NULL', document_type: 'VARCHAR(50) NOT NULL', subject_id: 'INT NOT NULL', gcs_key: 'VARCHAR(500)', year: 'INT', series: 'VARCHAR(50)', paper: 'VARCHAR(50)', variant: 'VARCHAR(50)', created_at: 'DATETIME' }
  // (Full set would be mapped here, simplified for generation)
};

async function audit() {
  let conn;
  try {
    console.log('Connecting to MySQL...');
    conn = await mysql.createConnection(DB_CONFIG);
  } catch (err) {
    console.error('Failed to connect to MySQL:', err.message);
    process.exit(1);
  }

  const [tablesResult] = await conn.query('SHOW TABLES;');
  const existingTables = tablesResult.map(t => Object.values(t)[0]).filter(t => t.startsWith('api_'));
  
  let auditMarkdown = `# Blackboard AI MySQL Schema Audit\n\n`;
  auditMarkdown += `## 1. Existing Tables Found (${existingTables.length})\n`;
  existingTables.forEach(t => auditMarkdown += `- ${t}\n`);

  let missingTables = [];
  let missingColumns = [];
  let migrationSql = `-- Blackboard AI Migration\n\n`;

  for (const expectedTable of Object.keys(EXPECTED_TABLES)) {
    if (!existingTables.includes(expectedTable)) {
      missingTables.push(expectedTable);
      migrationSql += `-- Needs CREATE TABLE: ${expectedTable}\n`;
    } else {
      const [cols] = await conn.query(`DESCRIBE ${expectedTable};`);
      const existingCols = cols.map(c => c.Field);
      for (const expectedCol of Object.keys(EXPECTED_TABLES[expectedTable])) {
        if (!existingCols.includes(expectedCol)) {
          missingColumns.push({table: expectedTable, col: expectedCol});
          migrationSql += `ALTER TABLE ${expectedTable} ADD COLUMN ${expectedCol} ${EXPECTED_TABLES[expectedTable][expectedCol]};\n`;
        }
      }
    }
  }

  auditMarkdown += `\n## 2. Missing Tables (${missingTables.length})\n`;
  missingTables.forEach(t => auditMarkdown += `- ${t}\n`);

  auditMarkdown += `\n## 3. Missing Columns (${missingColumns.length})\n`;
  missingColumns.forEach(c => auditMarkdown += `- ${c.table}.${c.col}\n`);

  try {
    fs.writeFileSync(SQL_FILE, migrationSql);
    fs.writeFileSync(AUDIT_FILE, auditMarkdown);
    console.log(`\nAudit Complete!`);
    console.log(`- Existing api_* tables: ${existingTables.length}`);
    console.log(`- Missing tables: ${missingTables.length}`);
    console.log(`- Missing columns: ${missingColumns.length}`);
    console.log(`\nSaved to ${SQL_FILE} and ${AUDIT_FILE}`);
  } catch (e) {
    console.error('Failed to write files. Are you running this on Contabo?', e.message);
  }
  
  await conn.end();
}

audit();
