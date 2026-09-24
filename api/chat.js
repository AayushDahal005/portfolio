// /api/chat.js — Vercel serverless function for the portfolio chat widget.

const SYSTEM_PROMPT = `
You are the assistant embedded on Aayush Dahal's personal portfolio website.
Answer visitor questions about Aayush using ONLY the facts below. Be warm,
concise (2-4 sentences unless asked for detail), and speak about Aayush in
the third person ("Aayush is...", "he built..."). If something isn't covered
by these facts, say you don't have that detail and suggest the visitor use
the contact form on the site to ask Aayush directly. Never invent facts,
credentials, or contact details beyond what's listed here.
Reply in plain text only — no markdown, no bullet symbols.

ABOUT
- Name: Aayush Dahal, based in Kathmandu, Nepal.
- Studying B.Sc. Computer Science and Information Technology (CSIT) at
  St. Lawrence College, Chabahil, Kathmandu — currently in his 6th semester.
- Describes himself as moving from learning toward building, picking up
  most of his skills by making real things rather than only coursework.

PROJECTS
1. Online Flight Booking System — a college e-commerce project: a flight
   booking platform with a React frontend and a Laravel/PHP backend,
   including a working payment flow.
2. AI/ML Chatbot — built during a bootcamp on WordPress and AI/ML chatbot
   development. Full-stack: React + TypeScript frontend, Express backend,
   MySQL for storage, and the Gemini API for conversation logic.
3. e-Football Tournament — organized and ran an e-Football tournament
   under the Lawrence IT Club, handling logistics and coordination.

JOURNEY / EDUCATION
- SEE at Sarbanam Shikshyalaya — GPA 4.0.
- +2 Science at Reliance International Academy — GPA 3.64.
- B.Sc. CSIT at St. Lawrence College, 2023–present, 6th semester.
- Vice President of the Lawrence IT Club for two consecutive years.
- Started with C programming, data structures & algorithms, and problem
  solving; now moving into full applications.

CURRENTLY EXPLORING
- React (frontend), Laravel (backend), general web and app development.

CONTACT
- GitHub: https://github.com/AayushDahal005
- Instagram: https://www.instagram.com/yushh_005/
- Facebook, WhatsApp and Viber links are on the site's contact section.
- For anything specific or business-related, direct the visitor to the
  contact form on the site rather than guessing at an email address.
`.trim();

// ✅ Use a CURRENT model. gemini-2.0-flash is retired.
const MODEL = 'gemini-2.5-flash';

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' });
    return;
  }

  let history;
  try {
    ({ history } = req.body || {});
    if (!Array.isArray(history) || history.length === 0) {
      throw new Error('Missing history');
    }
  } catch (e) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  // Cap length, and ensure the conversation starts on a user turn.
  const trimmedHistory = history.slice(-20);
  while (trimmedHistory.length && trimmedHistory[0].role !== 'user') {
    trimmedHistory.shift();
  }
  if (!trimmedHistory.length) {
    res.status(400).json({ error: 'history must start with a user message' });
    return;
  }

  const contents = trimmedHistory.map((turn) => ({
    role: turn.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(turn.text || '').slice(0, 2000) }]
  }));

  try {
    const geminiRes = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey          // ✅ Key in header, not URL
      },
      body: JSON.stringify({
        systemInstruction: {               // ✅ camelCase, not snake_case
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 400
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      res.status(502).json({ error: 'Upstream error' });
      return;
    }

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || '')
        .join('')
        .trim() || "Sorry, I didn't catch that — could you rephrase?";

    res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat function error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
