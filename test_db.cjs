const mysql = require('mysql2/promise');
async function check() {
    const conn = await mysql.createConnection({
        host: '127.0.0.1', port: 3306, user: 'blackboard_user', password: 'BlackboardAI2024!', database: 'blackboard_ai'
    });
    const [rows] = await conn.query('SELECT COUNT(*) AS c FROM api_document WHERE subject_id = 159');
    console.log("Count:", rows[0].c);
    const [subj] = await conn.query('SELECT * FROM api_subject WHERE id = 159');
    console.log("Subject:", subj[0]);
    await conn.end();
}
check();
