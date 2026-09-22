const fs = require('fs');

const liveSchema = JSON.parse(fs.readFileSync('live_schema.json', 'utf8'));
const expectedSql = fs.readFileSync('LOCAL_MYSQL_SCHEMA_MIGRATION.sql', 'utf8');

// Parse Expected Tables from my previous SQL file
const expectedTables = {};
const tableRegex = /CREATE TABLE IF NOT EXISTS (api_\w+) \(([\s\S]*?)\);/g;
let match;
while ((match = tableRegex.exec(expectedSql)) !== null) {
  const tableName = match[1];
  const colLines = match[2].split(',\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('FOREIGN KEY') && !l.startsWith('UNIQUE KEY'));
  expectedTables[tableName] = {};
  for (const line of colLines) {
    const parts = line.split(' ');
    const colName = parts[0];
    if (colName !== 'FOREIGN' && colName !== 'UNIQUE' && colName !== 'PRIMARY') {
        expectedTables[tableName][colName] = parts.slice(1).join(' ');
    }
  }
}

let auditMarkdown = `# Blackboard AI Live Database Schema Audit\n\n`;
auditMarkdown += `## 1. Existing Tables Found (${Object.keys(liveSchema).length})\n`;
for (const t of Object.keys(liveSchema)) auditMarkdown += `- ${t}\n`;

auditMarkdown += `\n## 2. Backend Tables Referenced (${Object.keys(expectedTables).length})\n`;
for (const t of Object.keys(expectedTables)) auditMarkdown += `- ${t}\n`;

const missingTables = [];
const missingColumns = [];
let migrationSql = `-- ============================================\n-- LIVE DB MIGRATION: Blackboard AI\n-- ============================================\n\n`;

for (const expectedTable of Object.keys(expectedTables)) {
  if (!liveSchema[expectedTable]) {
    missingTables.push(expectedTable);
    // Find the original create statement
    const exactRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${expectedTable} \\([\\s\\S]*?\\);`);
    const createStmt = expectedSql.match(exactRegex);
    migrationSql += `-- Missing table ${expectedTable}\n`;
    migrationSql += createStmt[0] + '\n\n';
  } else {
    // Compare columns
    const liveCols = liveSchema[expectedTable].map(c => c.Field);
    for (const [colName, colDef] of Object.entries(expectedTables[expectedTable])) {
      if (!liveCols.includes(colName)) {
        missingColumns.push(`${expectedTable}.${colName}`);
        migrationSql += `ALTER TABLE ${expectedTable} ADD COLUMN IF NOT EXISTS ${colName} ${colDef};\n`;
      }
    }
  }
}

auditMarkdown += `\n## 3. Missing Tables (${missingTables.length})\n`;
for (const t of missingTables) auditMarkdown += `- ${t}\n`;

auditMarkdown += `\n## 4. Missing Columns (${missingColumns.length})\n`;
for (const c of missingColumns) auditMarkdown += `- ${c}\n`;

auditMarkdown += `\n## 5. Type & Constraint Risks\n`;
auditMarkdown += `- We avoided dropping tables or columns to protect existing data.\n`;
auditMarkdown += `- Unused tables like \`api_userprogress\` are left untouched.\n`;

fs.writeFileSync('LOCAL_MYSQL_SCHEMA_MIGRATION_LIVE.sql', migrationSql);
fs.writeFileSync('LOCAL_MYSQL_SCHEMA_AUDIT_LIVE.md', auditMarkdown);
console.log('Diff complete');
