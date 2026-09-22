# Blackboard AI Live Database Schema Audit

## 1. Existing Tables Found (22)
- api_document
- api_flashcard
- api_flashcardreviewevent
- api_flashcardset
- api_flashcardstudysession
- api_mcqquestion
- api_mcqquiz
- api_pendinguser
- api_quiz
- api_quizanswer
- api_quizattempt
- api_quizquestion
- api_subject
- api_user
- api_user_groups
- api_user_user_permissions
- api_userprofile
- api_userprogress
- api_userprogress_documents_viewed
- api_userprogress_flashcards_studied
- api_userprogress_quizzes_completed
- api_usersubject

## 2. Backend Tables Referenced (34)
- api_user
- api_pendinguser
- api_userprofile
- api_subject
- api_usersubject
- api_document
- api_studysession
- api_sessionquestion
- api_questionanswer
- api_questionanswerattachment
- api_questionevaluation
- api_questionchatmessage
- api_chatthread
- api_chatmessage
- api_chatattachment
- api_aicheckerevaluation
- api_flashcardset
- api_flashcard
- api_flashcardstudysession
- api_flashcardreviewevent
- api_usersubscription
- api_userusagelimit
- api_aiusagelog
- api_sessionquestionusage
- api_documentextractioncache
- api_quiz
- api_quizquestion
- api_quizattempt
- api_quizanswer
- api_devicetoken
- api_questionmapping
- api_mcqquiz
- api_mcqanswerkey
- api_ragchunk

## 3. Missing Tables (19)
- api_studysession
- api_sessionquestion
- api_questionanswer
- api_questionanswerattachment
- api_questionevaluation
- api_questionchatmessage
- api_chatthread
- api_chatmessage
- api_chatattachment
- api_aicheckerevaluation
- api_usersubscription
- api_userusagelimit
- api_aiusagelog
- api_sessionquestionusage
- api_documentextractioncache
- api_devicetoken
- api_questionmapping
- api_mcqanswerkey
- api_ragchunk

## 4. Missing Columns (5)
- api_flashcardset.sources
- api_flashcard.sources
- api_quiz.sources
- api_quizquestion.sources
- api_quizattempt.completed_at

## 5. Type & Constraint Risks
- We avoided dropping tables or columns to protect existing data.
- Unused tables like `api_userprogress` are left untouched.
