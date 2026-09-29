import { executeQuery } from "./databaseHelper.js";

export const deleteUserSubjectData = async (userId, subjectId) => {
    // We assume api_quiz, api_flashcardset, api_studysession all have 
    // ON DELETE CASCADE constraints, or they don't have constraints preventing deletion.
    // Actually, in cascadeDelete.js, it says some constraints are missing ON DELETE CASCADE.
    // For now, let's just execute DELETE statements for the parent records and see if it works.
    
    // We don't have a database connection to test ON DELETE CASCADE. 
    // Let's use deleteDependentRows from cascadeDelete.js if needed.
}
