// /api/chat.js
// Vercel serverless function. Keeps the Gemini API key server-side and
// answers as an assistant for Aayush Dahal's portfolio.
//
// Setup:
//   1. Put this file at  api/chat.js  in your project root (same level as
//      index.html) and redeploy on Vercel — it's auto-detected, no config
//      needed for a plain static site.
//   2. In Vercel → Project → Settings → Environment Variables, add:
//        GEMINI_API_KEY = <your key from https://aistudio.google.com/apikey>
//   3. Redeploy so the new env var is picked up.

const SYSTEM_PROMPT = `
You are the assistant embedded on Aayush Dahal's personal portfolio website.
Answer visitor questions about Aayush using ONLY the facts below. Be warm,
concise (2-4 sentences unless asked for detail), and speak about Aayush in
the third person ("Aayush is...", "he built..."). If something isn't covered
by these facts, say you don't have that detail and suggest the visitor use
the contact form on the site to ask Aayush directly. Never invent facts,
credentials, or contact details beyond what's listed here.

ABOUT
- Name: Aayush Dahal, based in Kathmandu, Nepal.
- Studying B.Sc. Computer Science and Information Technology (CSIT) at
  St. Lawrence College, Chabahil, Kathmandu — currently in his 6th semester.
- Describes himself as moving from learning toward building, picking up
  most of his skills by making real things rather than only coursework.

PROJECTS
1. Online Flight Booking System — a college e-commerce project: a flight
   booking platform with a React frontend and a Laravel/PHP backend,
   including a working payment flow. Built end-to-end rather than as a
   static demo.
2. AI/ML Chatbot — built during a bootcamp on WordPress and AI/ML chatbot
   development. Full-stack: React + TypeScript frontend, Express backend,
   MySQL for storage, and the Gemini API for conversation logic.
3. e-Football Tournament — organized and ran an e-Football tournament
   under the Lawrence IT Club, handling logistics and coordination.

JOURNEY / EDUCATION
- SEE (secondary education) at Sarbanam Shikshyalaya — GPA 4.0.
- +2 Science at Reliance International Academy — GPA 3.64.
- B.Sc. CSIT at St. Lawrence College, 2023–present, 6th semester.
- Vice President of the Lawrence IT Club for two consecutive years.
- Started with C programming, data structures & algorithms, and problem
  solving; now moving into full applications.

CURRENTLY EXPLORING
- React (frontend), Laravel (backend), general web and app development
  practice.

CONTACT
- GitHub: https://github.com/AayushDahal005
- Instagram: https://www.instagram.com/yushh_005/
- Facebook, WhatsApp and Viber links are on the site's contact section.
- For anything specific or business-related, direct the visitor to the
  contact form on the site rather than guessing at an email address.
`.trim();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  // Cap history length so requests can't grow unbounded.
  const trimmedHistory = history.slice(-20);

  const contents = trimmedHistory.map((turn) => ({
    role: turn.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(turn.text || '').slice(0, 2000) }]
  }));

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 400
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      res.status(502).json({ error: 'Upstream error' });
      return;
    }

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Sorry, I didn't catch that — could you rephrase?";

    res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat function error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};