# SQL Interview Trainer Backend v15

Backend for SQL Interview Trainer with selectable AI provider.

Supported providers:

- `ollama` — local free generation on your computer
- `gemini` — Google Gemini API
- `openai` — OpenAI API

## Install

```powershell
cd D:\projects\sql-interview-app\sql_interview_capacitor_v1\backend
npm install --no-audit --no-fund --registry=https://registry.npmjs.org/
copy .env.example .env
notepad .env
```

## Use Ollama

Install Ollama, then:

```powershell
ollama pull llama3.2:3b
```

In `.env`:

```env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

Start backend:

```powershell
npm run dev
```

Check:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Generate:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/generate-question" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"topic":"JOIN","level":"mid","type":"write_sql"}'
```

## Use Gemini

In `.env`:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
```

Restart backend after changing `.env`.

## Use OpenAI

In `.env`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Restart backend after changing `.env`.

## Supabase

If Supabase is configured, generated questions can be saved permanently to `questions`.
If Supabase is not configured, saved questions are kept only in server memory until restart.
