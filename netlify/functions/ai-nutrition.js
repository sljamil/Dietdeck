// DietDeck — Groq AI nutrition proxy
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { food, grams } = JSON.parse(event.body || '{}');
    if (!food || !grams) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing food or grams' }) };

    const prompt = `You are a precise nutrition database. Return nutrition facts for "${food}" per ${grams} grams.
Respond ONLY with a valid JSON object, no markdown, no explanation, no extra text whatsoever:
{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"sugar_g":0,"sodium_mg":0}
Use realistic, accurate values. For regional dishes estimate based on typical recipe.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 150,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      if (response.status === 429) return { statusCode: 429, headers, body: JSON.stringify({ error: 'rate_limit', message: 'AI limit reached, try again shortly' }) };
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'ai_error', message: err.error?.message || 'AI unavailable' }) };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server_error', message: e.message }) };
  }
};
