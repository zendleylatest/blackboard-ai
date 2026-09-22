const fs = require('fs');

const tablesJson = JSON.parse(fs.readFileSync('tables.json', 'utf8'));

const missingTables = [
    "api_studysession", "api_sessionquestion", "api_questionanswer",
    "api_questionanswerattachment", "api_questionevaluation", "api_questionchatmessage",
    "api_chatthread", "api_chatmessage", "api_chatattachment", "api_aicheckerevaluation",
    "api_usersubscription", "api_userusagelimit", "api_aiusagelog", "api_sessionquestionusage",
    "api_documentextractioncache", "api_devicetoken", "api_questionmapping",
    "api_mcqanswerkey", "api_ragchunk"
];

const parentPKs = {
    'user_id': 'bigint',
    'subject_id': 'bigint',
    'document_id': 'bigint',
    'question_paper_id': 'bigint',
    'mark_scheme_id': 'bigint',
    'quiz_id': 'char(32)',
    'attempt_id': 'bigint',
    'thread_id': 'char(32)',
    'message_id': 'char(32)',
    'answer_id': 'bigint',
    'session_id': 'char(32)',
    'session_question_id': 'bigint',
    'uploader_id': 'bigint'
};

const inferredTypes = {
    'id': 'char(32)', // By default, let's see. If the code uses UUIDs, char(32) or varchar(36)
    'created_at': 'datetime(6)',
    'updated_at': 'datetime(6)',
    'deleted_at': 'datetime(6)',
    'started_at': 'datetime(6)',
    'completed_at': 'datetime(6)',
    'evaluated_at': 'datetime(6)',
    'submitted_at': 'datetime(6)',
    'status': 'varchar(50)',
    'title': 'varchar(255)',
    'role': 'varchar(50)',
    'mode': 'varchar(50)',
    'text': 'longtext',
    'sources': 'json',
    'metadata': 'json',
    'tokens_in': 'int',
    'tokens_out': 'int',
    'original_filename': 'varchar(255)',
    'mime': 'varchar(100)',
    'size_bytes': 'bigint',
    'kind': 'varchar(50)',
    'openai_file_id': 'varchar(100)',
    'gcs_key': 'varchar(500)',
    'preview_url': 'longtext',
    'model_name': 'varchar(100)',
    'chunk_ids': 'json',
    'marks_awarded': 'double',
    'max_marks': 'double',
    'percentage': 'double',
    'evaluation_time_seconds': 'double',
    'tokens_used': 'int',
    'marking_rubric': 'json',
    'feedback': 'longtext',
    'strengths': 'json',
    'improvements': 'json',
    'student_answer': 'longtext',
    'question_text': 'longtext',
    'mark_scheme_text': 'longtext',
    'question_number': 'varchar(50)',
    'question_part': 'varchar(50)',
    'question_subpart': 'varchar(50)',
    'tier': 'varchar(50)',
    'store': 'varchar(50)',
    'product_id': 'varchar(255)',
    'is_active': 'tinyint(1)',
    'expires_at': 'datetime(6)',
    'original_purchase_date': 'datetime(6)',
    'cancellation_date': 'datetime(6)',
    'last_webhook_event': 'datetime(6)',
    'revenuecat_app_user_id': 'varchar(255)',
    'is_latest': 'tinyint(1)',
    'revision_number': 'int',
    'pdf_page_number': 'int',
    'display_order': 'int',
    'marks_available': 'int',
    'total_questions': 'int',
    'questions_answered': 'int',
    'total_marks_available': 'int',
    'total_marks_earned': 'int',
    'model_used': 'varchar(100)',
    'feature': 'varchar(100)',
    'questions_data': 'json',
    'marking_breakdown': 'json',
    'related_answer_id': 'bigint',
    'flashcard_sets_created': 'int',
    'quizzes_created': 'int',
    'ai_checker_uses': 'int',
    'past_paper_questions_used': 'int',
    'study_sessions_created': 'int',
    'chat_messages_sent': 'int',
    'mcq_wrong_reviews_used': 'int',
    'current_week_end': 'datetime(6)',
    'prompt_tokens': 'int',
    'completion_tokens': 'int',
    'total_tokens': 'int',
    'estimated_cost_usd': 'double',
    'answer_revisions': 'int',
    'followup_messages': 'int',
    'extraction_data': 'json',
    'extraction_model': 'varchar(100)',
    'processing_time_seconds': 'double',
    'token': 'varchar(255)',
    'platform': 'varchar(50)',
    'mapping_data': 'json',
    'key_data': 'json',
    'content': 'longtext',
};

const tableColumns = {};

for (const table of missingTables) {
    tableColumns[table] = new Set();
    const queries = tablesJson[table] || [];
    for (const q of queries) {
        // Very basic extraction of columns used in SELECT, INSERT, UPDATE
        // This is a rough heuristic to gather mentioned columns
        const words = q.split(/[\s,\(\)\=]+/);
        for (const w of words) {
            const clean = w.replace(/^[a-z]\./, '').toLowerCase(); // e.g., t.user_id -> user_id
            if (inferredTypes[clean] || parentPKs[clean]) {
                tableColumns[table].add(clean);
            }
        }
    }
}

let sql = `-- ============================================\n-- V2 MIGRATION SCRIPT\n-- ============================================\n\n`;
let md = `# Blackboard AI MySQL Schema Audit V2\n\n| Table | Required by active code? | Feature | Columns actually required | Parent tables | Risk | Recommended action |\n|---|---|---|---|---|---|---|\n`;

for (const table of missingTables) {
    const cols = Array.from(tableColumns[table]);
    const isActive = cols.length > 0;
    
    // For id, if not specified in parentPKs, let's default to bigInt if it's typically auto increment, 
    // or char(32) if the code uses UUIDs. Let's make a guess based on the code queries (e.g. normalizeUuid).
    // Let's assume char(32) for threads/messages/sessions, bigint for mapping/tokens.
    const isCharId = ['api_chatthread', 'api_chatmessage', 'api_chatattachment', 'api_aicheckerevaluation', 'api_studysession'].includes(table);
    
    if (isActive) {
        if (!cols.includes('id')) cols.unshift('id');
        let pkType = isCharId ? 'char(32)' : 'bigint AUTO_INCREMENT';
        
        sql += `CREATE TABLE IF NOT EXISTS ${table} (\n`;
        sql += `  id ${pkType} PRIMARY KEY,\n`;
        
        let parents = [];
        
        for (const col of cols) {
            if (col === 'id') continue;
            let type = parentPKs[col] || inferredTypes[col] || 'varchar(255)';
            if (parentPKs[col]) parents.push(col);
            sql += `  ${col} ${type},\n`;
        }
        
        sql += `  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP\n`;
        sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;
        
        md += `| ${table} | Yes | General | ${cols.join(', ')} | ${parents.join(', ')} | Low | CREATE TABLE |\n`;
    } else {
        md += `| ${table} | No / Dead Code | Unknown | None detected | None | None | Skip for now |\n`;
    }
}

// 5 Missing columns
sql += `\n-- Missing columns from V1\n`;
sql += `ALTER TABLE api_flashcardset ADD COLUMN IF NOT EXISTS sources JSON;\n`;
sql += `ALTER TABLE api_flashcard ADD COLUMN IF NOT EXISTS sources JSON;\n`;
sql += `ALTER TABLE api_quiz ADD COLUMN IF NOT EXISTS sources JSON;\n`;
sql += `ALTER TABLE api_quizquestion ADD COLUMN IF NOT EXISTS sources JSON;\n`;
sql += `ALTER TABLE api_quizattempt ADD COLUMN IF NOT EXISTS completed_at DATETIME(6);\n`;

fs.writeFileSync('LOCAL_MYSQL_SCHEMA_MIGRATION_V2.sql', sql);
fs.writeFileSync('LOCAL_MYSQL_SCHEMA_AUDIT_V2.md', md);
console.log('V2 Artifacts generated successfully');
