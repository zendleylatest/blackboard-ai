const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host: '127.0.0.1', port: 3306, user: 'blackboard_user', password: 'BlackboardAI2024!', database: 'blackboard_ai'});
  const [rows] = await conn.query('SHOW TABLES');
  console.log(rows);
  await conn.end();
}
run();
