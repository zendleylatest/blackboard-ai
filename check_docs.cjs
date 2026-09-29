const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host: '127.0.0.1', user: 'blackboard_user', password: 'BlackboardAI2024!', database: 'blackboard_ai'});
  const [rows] = await conn.query('SELECT subject_id, COUNT(*) as c FROM api_document GROUP BY subject_id ORDER BY c DESC LIMIT 10');
  console.log(rows);
  await conn.end();
}
run();
