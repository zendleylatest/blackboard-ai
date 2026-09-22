const fs = require('fs');

const schemas = {
  api_studysession: {
    columns: {
      id: 'char(32)',
      title: 'varchar(255)',
      status: "varchar(50) DEFAULT 'in_progress'",
      questions_data: 'json',
      questions_answered: 'int DEFAULT 0',
      total_questions: 'int DEFAULT 0',
      total_marks_available: 'int DEFAULT 0',
      total_marks_earned: 'int DEFAULT 0',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      updated_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      completed_at: 'datetime(6) DEFAULT NULL',
      user_id: 'bigint',
      subject_id: 'bigint',
      question_paper_id: 'bigint',
      mark_scheme_id: 'bigint',
    },
    pk: 'id',
    fk: { user_id: 'api_user(id)', subject_id: 'api_subject(id)' },
    category: 'A',
    evidence: 'createStudySession in dml_queries.txt'
  },
  api_sessionquestion: {
    columns: {
      id: 'char(32)',
      question_number: 'varchar(50)',
      question_part: 'varchar(50)',
      question_subpart: 'varchar(50)',
      question_text: 'longtext',
      marks_available: 'int',
      pdf_page_number: 'int',
      display_order: 'int',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      session_id: 'char(32)'
    },
    pk: 'id',
    fk: { session_id: 'api_studysession(id)' },
    category: 'A',
    evidence: 'createSessionQuestion in dml_queries.txt'
  },
  api_questionanswer: {
    columns: {
      id: 'char(32)',
      answer_text: 'longtext',
      is_latest: 'tinyint(1) DEFAULT 1',
      revision_number: 'int',
      submitted_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      session_question_id: 'char(32)'
    },
    pk: 'id',
    fk: { session_question_id: 'api_sessionquestion(id)' },
    category: 'A',
    evidence: 'createQuestionAnswer in dml_queries.txt'
  },
  api_questionanswerattachment: {
    columns: {
      id: 'char(32)',
      gcs_key: 'varchar(500)',
      original_filename: 'varchar(255)',
      kind: 'varchar(50)',
      size_bytes: 'bigint',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      answer_id: 'char(32)'
    },
    pk: 'id',
    fk: { answer_id: 'api_questionanswer(id)' },
    category: 'A',
    evidence: 'createQuestionAnswerAttachment in dml_queries.txt'
  },
  api_questionevaluation: {
    columns: {
      id: 'char(32)',
      marks_awarded: 'double',
      max_marks: 'double',
      percentage: 'double',
      marking_breakdown: 'json',
      feedback: 'longtext',
      mark_scheme_text: 'longtext',
      question_text: 'longtext',
      model_used: 'varchar(100)',
      evaluation_time_seconds: 'double',
      tokens_used: 'json',
      evaluated_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      answer_id: 'char(32)'
    },
    pk: 'id',
    fk: { answer_id: 'api_questionanswer(id)' },
    category: 'A',
    evidence: 'createQuestionEvaluation in dml_queries.txt'
  },
  api_questionchatmessage: {
    columns: {
      id: 'char(32)',
      role: 'varchar(50)',
      text: 'longtext',
      sources: 'json',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      session_question_id: 'char(32)',
      related_answer_id: 'char(32) DEFAULT NULL'
    },
    pk: 'id',
    fk: { session_question_id: 'api_sessionquestion(id)' },
    category: 'A',
    evidence: 'createQuestionChatMessage in dml_queries.txt'
  },
  api_chatthread: {
    columns: {
      id: 'char(32)',
      user_id: 'bigint',
      subject_id: 'bigint',
      title: 'varchar(255)',
      summary: 'longtext',
      last_message_preview: 'varchar(255)',
      last_message_at: 'datetime(6) DEFAULT NULL',
      openai_vector_store_id: 'varchar(100)',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      updated_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)'
    },
    pk: 'id',
    fk: { user_id: 'api_user(id)', subject_id: 'api_subject(id)' },
    category: 'A',
    evidence: 'createChatThread in dml_queries.txt'
  },
  api_chatmessage: {
    columns: {
      id: 'char(32)',
      thread_id: 'char(32)',
      role: 'varchar(50)',
      mode: 'varchar(50)',
      text: 'longtext',
      tokens_in: 'int DEFAULT 0',
      tokens_out: 'int DEFAULT 0',
      model_name: 'varchar(100)',
      chunk_ids: 'json',
      sources: 'json',
      metadata: 'json',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)'
    },
    pk: 'id',
    fk: { thread_id: 'api_chatthread(id)' },
    category: 'A',
    evidence: 'createChatMessage in dml_queries.txt'
  },
  api_chatattachment: {
    columns: {
      id: 'char(32)',
      thread_id: 'char(32)',
      uploader_id: 'bigint',
      message_id: 'char(32) DEFAULT NULL',
      original_filename: 'varchar(255)',
      mime: 'varchar(100)',
      size_bytes: 'bigint',
      kind: 'varchar(50)',
      status: 'varchar(50)',
      openai_file_id: 'varchar(100)',
      gcs_key: 'varchar(500)',
      preview_url: 'longtext',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)'
    },
    pk: 'id',
    fk: { thread_id: 'api_chatthread(id)', uploader_id: 'api_user(id)' },
    category: 'A',
    evidence: 'createChatAttachment in dml_queries.txt'
  },
  api_aicheckerevaluation: {
    columns: {
      id: 'char(32)',
      mode: 'varchar(50)',
      question_text: 'longtext',
      student_answer: 'longtext',
      question_number: 'varchar(50)',
      question_part: 'varchar(50)',
      question_subpart: 'varchar(50)',
      marks_awarded: 'double',
      max_marks: 'double',
      marking_rubric: 'json',
      feedback: 'longtext',
      strengths: 'json',
      improvements: 'json',
      model_used: 'varchar(100)',
      evaluation_time_seconds: 'double',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      message_id: 'char(32)',
      question_paper_id: 'bigint',
      thread_id: 'char(32)'
    },
    pk: 'id',
    fk: { message_id: 'api_chatmessage(id)', thread_id: 'api_chatthread(id)' },
    category: 'A',
    evidence: 'createAiCheckerEvaluation in dml_queries.txt'
  },
  api_usersubscription: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      tier: 'varchar(50)',
      revenuecat_app_user_id: 'varchar(255)',
      store: 'varchar(50)',
      product_id: 'varchar(255)',
      is_active: 'tinyint(1) DEFAULT 0',
      expires_at: 'datetime(6) DEFAULT NULL',
      original_purchase_date: 'datetime(6) DEFAULT NULL',
      cancellation_date: 'datetime(6) DEFAULT NULL',
      last_webhook_event: 'varchar(100) DEFAULT NULL',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      updated_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      user_id: 'bigint'
    },
    pk: 'id',
    unique: ['user_id'],
    fk: { user_id: 'api_user(id)' },
    category: 'A',
    evidence: 'handleRevenueCatWebhook in dml_queries.txt'
  },
  api_userusagelimit: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      user_id: 'bigint',
      flashcard_sets_created: 'int DEFAULT 0',
      quizzes_created: 'int DEFAULT 0',
      ai_checker_uses: 'int DEFAULT 0',
      past_paper_questions_used: 'int DEFAULT 0',
      study_sessions_created: 'int DEFAULT 0',
      chat_messages_sent: 'int DEFAULT 0',
      mcq_wrong_reviews_used: 'int DEFAULT 0',
      current_week_end: 'datetime(6)',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      updated_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)'
    },
    pk: 'id',
    unique: ['user_id'],
    fk: { user_id: 'api_user(id)' },
    category: 'A',
    evidence: 'getOrCreateUsage in dml_queries.txt'
  },
  api_aiusagelog: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      user_id: 'bigint',
      feature: 'varchar(100)',
      model: 'varchar(100)',
      prompt_tokens: 'int DEFAULT 0',
      completion_tokens: 'int DEFAULT 0',
      total_tokens: 'int DEFAULT 0',
      estimated_cost_usd: 'double DEFAULT 0',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)'
    },
    pk: 'id',
    fk: { user_id: 'api_user(id)' },
    category: 'A',
    evidence: 'logUsage in dml_queries.txt'
  },
  api_sessionquestionusage: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      answer_revisions: 'int DEFAULT 0',
      followup_messages: 'int DEFAULT 0',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      updated_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      session_question_id: 'char(32)'
    },
    pk: 'id',
    unique: ['session_question_id'],
    fk: { session_question_id: 'api_sessionquestion(id)' },
    category: 'A',
    evidence: 'checkSessionQuestionLimit in dml_queries.txt'
  },
  api_documentextractioncache: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      question_paper_id: 'bigint',
      mark_scheme_id: 'bigint',
      extraction_data: 'json',
      extraction_model: 'varchar(100)',
      processing_time_seconds: 'double',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)'
    },
    pk: 'id',
    unique: ['question_paper_id'],
    fk: {},
    category: 'A',
    evidence: 'Document.js cache query'
  },
  api_devicetoken: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      token: 'varchar(255)',
      platform: 'varchar(50)',
      is_active: 'tinyint(1) DEFAULT 1',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      updated_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)',
      user_id: 'bigint'
    },
    pk: 'id',
    unique: ['token'],
    fk: { user_id: 'api_user(id)' },
    category: 'A',
    evidence: 'registerToken in dml_queries.txt'
  },
  api_questionmapping: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      document_id: 'bigint',
      question_number: 'varchar(50)',
      question_part: 'varchar(50)',
      question_subpart: 'varchar(50)',
      mark_scheme_text: 'longtext',
      max_marks: 'double',
      page_number: 'int',
      chunk_id: 'varchar(100)',
      created_at: 'datetime(6) DEFAULT CURRENT_TIMESTAMP(6)'
    },
    pk: 'id',
    fk: {},
    category: 'C',
    evidence: 'Only found SELECTs in tables.json, no INSERTs'
  },
  api_mcqanswerkey: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      answers: 'json',
      total_questions: 'int',
      extraction_method: 'varchar(100)',
      source_pdf_hash: 'varchar(255)',
      metadata: 'json',
      extracted_at: 'datetime(6)',
      updated_at: 'datetime(6)',
      mark_scheme_id: 'bigint',
      question_paper_id: 'bigint',
      subject_id: 'bigint'
    },
    pk: 'id',
    fk: {},
    category: 'C',
    evidence: 'Only SELECTs in tables.json'
  },
  api_ragchunk: {
    columns: {
      id: 'bigint AUTO_INCREMENT',
      content: 'longtext',
      kind: 'varchar(50)',
      page_number: 'int',
      qref: 'varchar(100)',
      pair_key: 'varchar(100)',
      document_id: 'bigint'
    },
    pk: 'id',
    fk: {},
    category: 'C',
    evidence: 'Only SELECTs in tables.json'
  }
};

let sqlOut = `-- ============================================\n-- LOCAL_MYSQL_SCHEMA_MIGRATION_V3.sql\n-- ============================================\n\n`;
let mdOut = `# LOCAL_MYSQL_SCHEMA_AUDIT_V3\n\n`;

let totalCols = 0;
let totalFks = 0;
let totalUniques = 0;

for (const [tName, table] of Object.entries(schemas)) {
  if (table.category !== 'A' && table.category !== 'B') {
      mdOut += `\n### TABLE: ${tName} (Category: ${table.category})\n- Reason: ${table.evidence}\n`;
      continue;
  }
  
  mdOut += `\n### TABLE: ${tName} (Category: ${table.category})\n\n**Columns:**\n`;
  sqlOut += `CREATE TABLE IF NOT EXISTS ${tName} (\n`;
  
  const colDefs = [];
  for (const [cName, cType] of Object.entries(table.columns)) {
      mdOut += `- ${cName} | ${cType} | ${cName === table.pk ? 'PK' : ''}\n`;
      colDefs.push(`  ${cName} ${cType}`);
      totalCols++;
  }
  
  colDefs.push(`  PRIMARY KEY (${table.pk})`);
  
  if (table.unique) {
      for (const u of table.unique) {
          colDefs.push(`  UNIQUE KEY ${tName}_${u}_uq (${u})`);
          totalUniques++;
      }
  }
  
  mdOut += `\n**Relationships:**\n`;
  if (table.fk) {
      for (const [fCol, fRef] of Object.entries(table.fk)) {
          const refT = fRef.split('(')[0];
          const refC = fRef.split('(')[1].replace(')', '');
          colDefs.push(`  CONSTRAINT fk_${tName}_${fCol} FOREIGN KEY (${fCol}) REFERENCES ${refT} (${refC}) ON DELETE CASCADE`);
          mdOut += `- ${fCol} -> ${fRef}\n`;
          totalFks++;
      }
  } else {
      mdOut += `- None\n`;
  }
  
  mdOut += `\n**Evidence:**\n- ${table.evidence}\n`;
  
  sqlOut += colDefs.join(',\n');
  sqlOut += `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;
}

// 5 Columns
sqlOut += `\n-- Existing Missing Columns\n`;
sqlOut += `ALTER TABLE api_flashcardset ADD COLUMN IF NOT EXISTS sources JSON;\n`;
sqlOut += `ALTER TABLE api_flashcard ADD COLUMN IF NOT EXISTS sources JSON;\n`;
sqlOut += `ALTER TABLE api_quiz ADD COLUMN IF NOT EXISTS sources JSON;\n`;
sqlOut += `ALTER TABLE api_quizquestion ADD COLUMN IF NOT EXISTS sources JSON;\n`;
sqlOut += `ALTER TABLE api_quizattempt ADD COLUMN IF NOT EXISTS completed_at DATETIME(6);\n`;

mdOut += `\n## Summary\n- Total columns across A/B tables: ${totalCols}\n- Total Foreign Keys: ${totalFks}\n- Total Unique Constraints: ${totalUniques}\n`;

fs.writeFileSync('LOCAL_MYSQL_SCHEMA_MIGRATION_V3.sql', sqlOut);
fs.writeFileSync('LOCAL_MYSQL_SCHEMA_AUDIT_V3.md', mdOut);
