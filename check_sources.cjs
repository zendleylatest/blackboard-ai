const fs = require('fs');
const text = fs.readFileSync('dml_queries.txt', 'utf8');

const check = (table) => {
    const idx = text.indexOf('=== ' + table + ' ===');
    if (idx === -1) return false;
    const end = text.indexOf('=== ', idx + 4);
    const chunk = text.slice(idx, end === -1 ? undefined : end);
    return chunk.includes('sources');
};

console.log('api_flashcardset:', check('api_flashcardset'));
console.log('api_flashcard:', check('api_flashcard'));
console.log('api_quiz:', check('api_quiz'));
console.log('api_quizquestion:', check('api_quizquestion'));
