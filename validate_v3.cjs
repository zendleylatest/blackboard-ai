const mysql = require('mysql2/promise');
const fs = require('fs');

async function check() {
    const conn = await mysql.createConnection({
        host: '127.0.0.1', port: 3306, user: 'blackboard_user', password: 'BlackboardAI2024!'
    });
    
    await conn.query('CREATE DATABASE IF NOT EXISTS blackboard_ai_test_v3');
    await conn.query('USE blackboard_ai_test_v3');
    
    // We only create parent tables to satisfy FKs for testing syntax
    const parentSql = `
    CREATE TABLE api_user (id BIGINT AUTO_INCREMENT PRIMARY KEY);
    CREATE TABLE api_subject (id BIGINT AUTO_INCREMENT PRIMARY KEY);
    CREATE TABLE api_document (id BIGINT AUTO_INCREMENT PRIMARY KEY);
    `;
    for (const stmt of parentSql.split(';')) {
        if (stmt.trim()) await conn.query(stmt);
    }
    
    const migration = fs.readFileSync('LOCAL_MYSQL_SCHEMA_MIGRATION_V3.sql', 'utf8');
    const stmts = migration.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
    let errorFound = false;
    for (const stmt of stmts) {
        if (stmt.includes('ALTER TABLE')) continue; // skip alters since they reference tables that might not exist in the test DB
        try {
            await conn.query(stmt);
            console.log('Passed:', stmt.split('\n')[0]);
        } catch (e) {
            console.error('SYNTAX ERROR:', e.message);
            console.error('STATEMENT:', stmt);
            errorFound = true;
        }
    }
    
    await conn.query('DROP DATABASE blackboard_ai_test_v3');
    await conn.end();
    
    if (errorFound) process.exit(1);
    else console.log('All CREATE TABLE statements are syntactically valid!');
}
check();
