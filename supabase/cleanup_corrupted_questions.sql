-- Удаляет повреждённые вопросы, где кириллица превратилась в знаки вопроса.
-- Выполнять в Supabase SQL Editor.
DELETE FROM questions
WHERE question LIKE '%????%'
   OR topic LIKE '%????%'
   OR explanation LIKE '%????%';
