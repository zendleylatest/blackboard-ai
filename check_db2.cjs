const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host: '127.0.0.1', user: 'blackboard_user', password: 'BlackboardAI2024!', database: 'blackboard_ai'});
  
  const [docs] = await conn.query('SELECT COUNT(*) as c FROM api_document');
  console.log("Total api_document rows:", docs[0].c);
  
  const [subjects] = await conn.query('SELECT COUNT(*) as c FROM api_subject');
  console.log("Total api_subject rows:", subjects[0].c);
  
  const [subj159] = await conn.query('SELECT * FROM api_subject WHERE id = 159');
  console.log("Subject 159:", subj159[0]);
  
  await conn.end();
}
run();
