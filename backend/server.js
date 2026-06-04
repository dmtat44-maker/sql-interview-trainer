import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const AI_PROVIDER = String(process.env.AI_PROVIDER || 'ollama').trim().toLowerCase();

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function hasRealValue(value) {
  if (!value) return false;
  const v = String(value).trim();
  if (!v) return false;
  if (v.includes('your-') || v.includes('your_')) return false;
  if (v.includes('твой') || v.includes('сюда')) return false;
  return true;
}

const openai = hasRealValue(process.env.OPENAI_API_KEY)
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const supabase = hasRealValue(process.env.SUPABASE_URL) && hasRealValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const memoryQuestions = [];

function aiConfigured() {
  if (AI_PROVIDER === 'ollama') return true;
  if (AI_PROVIDER === 'gemini') return hasRealValue(process.env.GEMINI_API_KEY);
  if (AI_PROVIDER === 'openai') return Boolean(openai);
  return false;
}

function toClient(row) {
  return {
    id: row.id,
    topic: row.topic,
    level: row.level,
    type: row.type || 'write_sql',
    question: row.question,
    schema_text: row.schema_text || '',
    correct_answer: row.correct_answer,
    explanation: row.explanation || '',
    checks: Array.isArray(row.checks) ? row.checks : [],
    options: Array.isArray(row.options) ? row.options : [],
    correct_option: Number.isInteger(row.correct_option) ? row.correct_option : null,
    source: row.source || 'ai'
  };
}

function sanitizeQuestion(input) {
  return {
    topic: String(input.topic || 'SQL').trim(),
    level: ['easy', 'mid', 'hard'].includes(input.level) ? input.level : 'mid',
    type: ['write_sql', 'debug', 'theory', 'choice'].includes(input.type) ? input.type : 'write_sql',
    question: String(input.question || input.q || '').trim(),
    schema_text: String(input.schema_text || input.schema || '').trim(),
    correct_answer: String(input.correct_answer || input.answer || '').trim(),
    explanation: String(input.explanation || input.trap || '').trim(),
    checks: Array.isArray(input.checks) ? input.checks : [],
    options: Array.isArray(input.options) ? input.options.map(String) : [],
    correct_option: Number.isInteger(input.correct_option) ? input.correct_option : null,
    source: input.source || `ai:${AI_PROVIDER}`,
    status: input.status || 'active'
  };
}

const questionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['topic', 'level', 'type', 'question', 'schema_text', 'correct_answer', 'explanation', 'checks', 'options', 'correct_option'],
  properties: {
    topic: { type: 'string' },
    level: { type: 'string', enum: ['easy', 'mid', 'hard'] },
    type: { type: 'string', enum: ['write_sql', 'debug', 'theory', 'choice'] },
    question: { type: 'string' },
    schema_text: { type: 'string' },
    correct_answer: { type: 'string' },
    explanation: { type: 'string' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'wrong', 'correct'],
        properties: {
          label: { type: 'string' },
          wrong: { type: 'string' },
          correct: { type: 'string' }
        }
      }
    },
    options: { type: 'array', items: { type: 'string' } },
    correct_option: { type: ['integer', 'null'] }
  }
};

function buildGenerationPrompt({ topic, level, type, base_question = '', base_schema = '', base_answer = '' }) {
  return [
    'Ты составляешь вопросы для подготовки к SQL-собеседованию.',
    'Верни только валидный JSON без markdown и без комментариев.',
    'Пиши на русском языке.',
    'Не описывай технические требования приложения.',
    'Вопрос должен быть практическим, реалистичным и проверяемым.',
    'Новый вопрос должен строго соответствовать переданной теме topic. Не меняй тему на бизнес-метрики, конверсию или аналитику, если topic не про это.',
    'Если указан base_question, создай похожий вопрос по тому же SQL-концепту, но с другой формулировкой или похожими таблицами.',
    'Поле topic в JSON должно точно совпадать с переданной темой.',
    'correct_answer должен быть полноценным SQL-ответом или точным объяснением.',
    'checks должны содержать только типичные ошибки, которые полезно показать пользователю.',
    'Если type = choice, заполни options и correct_option. Если type не choice, options = [], correct_option = null.',
    '',
    'Формат JSON:',
    JSON.stringify({
      topic,
      level,
      type,
      question: 'текст вопроса',
      schema_text: 'таблицы и поля, если нужны',
      correct_answer: 'правильный ответ',
      explanation: 'краткое объяснение',
      checks: [
        { label: 'что проверяем', wrong: 'типичная ошибка', correct: 'как правильно' }
      ],
      options: [],
      correct_option: null
    }, null, 2),
    '',
    `Создай один новый вопрос. Тема: ${topic}. Сложность: ${level}. Тип: ${type}.`,
    base_question ? `Базовый вопрос, от которого нужно отталкиваться: ${base_question}` : '',
    base_schema ? `Схема базового вопроса: ${base_schema}` : '',
    base_answer ? `Правильный ответ базового вопроса: ${base_answer}` : ''
  ].join('\n');
}

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('AI returned empty response');
  try {
    return JSON.parse(raw);
  } catch (_firstError) {
    const withoutFence = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try {
      return JSON.parse(withoutFence);
    } catch (_secondError) {
      const start = withoutFence.indexOf('{');
      const end = withoutFence.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(withoutFence.slice(start, end + 1));
      }
      throw new Error('AI response is not valid JSON');
    }
  }
}

async function generateWithOpenAI({ topic, level, type, base_question, base_schema, base_answer }) {
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  const prompt = buildGenerationPrompt({ topic, level, type, base_question, base_schema, base_answer });

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'Ты составляешь вопросы для подготовки к SQL-собеседованию. Возвращай только валидный JSON.' },
      { role: 'user', content: prompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'sql_interview_question', strict: true, schema: questionSchema }
    }
  });

  return JSON.parse(completion.choices[0].message.content);
}

async function generateWithGemini({ topic, level, type, base_question, base_schema, base_answer }) {
  if (!hasRealValue(process.env.GEMINI_API_KEY)) throw new Error('GEMINI_API_KEY is not configured');

  const prompt = buildGenerationPrompt({ topic, level, type, base_question, base_schema, base_answer });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        response_mime_type: 'application/json'
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(`Gemini error: ${message}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
  return extractJson(text);
}

async function generateWithOllama({ topic, level, type, base_question, base_schema, base_answer }) {
  const prompt = buildGenerationPrompt({ topic, level, type, base_question, base_schema, base_answer });

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.7 }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || response.statusText;
    throw new Error(`Ollama error: ${message}`);
  }

  return extractJson(data.response || '');
}

async function generateQuestion(params) {
  if (AI_PROVIDER === 'openai') return generateWithOpenAI(params);
  if (AI_PROVIDER === 'gemini') return generateWithGemini(params);
  if (AI_PROVIDER === 'ollama') return generateWithOllama(params);
  throw new Error(`Unknown AI_PROVIDER: ${AI_PROVIDER}`);
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    db: Boolean(supabase),
    ai: aiConfigured(),
    provider: AI_PROVIDER,
    model: AI_PROVIDER === 'openai' ? OPENAI_MODEL : AI_PROVIDER === 'gemini' ? GEMINI_MODEL : OLLAMA_MODEL
  });
});

app.get('/questions', async (req, res) => {
  try {
    const { topic, level } = req.query;

    if (!supabase) {
      let items = memoryQuestions;
      if (topic) items = items.filter(q => q.topic === topic);
      if (level) items = items.filter(q => q.level === level);
      return res.json(items.map(toClient));
    }

    let query = supabase
      .from('questions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (topic) query = query.eq('topic', topic);
    if (level) query = query.eq('level', level);

    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(toClient));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/questions', async (req, res) => {
  try {
    const row = sanitizeQuestion(req.body);
    if (!row.question || !row.correct_answer) {
      return res.status(400).json({ error: 'question and correct_answer are required' });
    }

    if (!supabase) {
      const saved = { ...row, id: 'memory_' + Date.now(), created_at: new Date().toISOString() };
      memoryQuestions.unshift(saved);
      return res.status(201).json(toClient(saved));
    }

    const { data, error } = await supabase
      .from('questions')
      .insert(row)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json(toClient(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/generate-question', async (req, res) => {
  try {
    if (!aiConfigured()) {
      return res.status(500).json({ error: `${AI_PROVIDER} is not configured` });
    }

    const topic = req.body.topic || 'JOIN';
    const level = ['easy', 'mid', 'hard'].includes(req.body.level) ? req.body.level : 'mid';
    const type = ['write_sql', 'debug', 'theory', 'choice'].includes(req.body.type) ? req.body.type : 'write_sql';
    const base_question = req.body.base_question || '';
    const base_schema = req.body.base_schema || '';
    const base_answer = req.body.base_answer || '';

    const generated = sanitizeQuestion(await generateQuestion({ topic, level, type, base_question, base_schema, base_answer }));
    generated.topic = topic;
    generated.level = level;
    res.json(generated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/attempts', async (req, res) => {
  try {
    const row = {
      question_id: req.body.question_id || null,
      user_answer: req.body.user_answer || '',
      is_correct: Boolean(req.body.is_correct),
      mistakes: Array.isArray(req.body.mistakes) ? req.body.mistakes : []
    };

    if (!supabase) {
      return res.status(201).json({ ...row, id: 'memory_attempt_' + Date.now() });
    }

    const { data, error } = await supabase
      .from('attempts')
      .insert(row)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`SQL Interview Trainer backend running on http://localhost:${PORT}`);
  console.log(`AI provider: ${AI_PROVIDER}`);
});
