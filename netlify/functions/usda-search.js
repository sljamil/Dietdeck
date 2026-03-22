// DietDeck — USDA FoodData Central proxy
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { query, fdcId, grams } = JSON.parse(event.body || '{}');
    const key = process.env.USDA_API_KEY || 'DEMO_KEY';

    // Single food detail fetch (when user picks a result)
    if (fdcId) {
      const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${key}`);
      if (!res.ok) throw new Error('USDA fetch failed');
      const food = await res.json();
      const s = (grams || 100) / 100;
      const g = (list, ids) => {
        for (const id of ids) {
          const n = list.find(x => x.nutrient?.id === id || x.nutrientId === id);
          if (n) return Math.round((n.amount || 0) * s * 10) / 10;
        }
        return 0;
      };
      const nutrients = food.foodNutrients || [];
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          cal:   g(nutrients, [1008, 2047, 2048]),
          prot:  g(nutrients, [1003]),
          carb:  g(nutrients, [1005]),
          fat:   g(nutrients, [1004]),
          fiber: g(nutrients, [1079]),
          sugar: g(nutrients, [2000, 1063]),
          sodium:g(nutrients, [1093]),
        }),
      };
    }

    // Search query
    if (!query || query.length < 2) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query too short' }) };
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy&pageSize=10&api_key=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('USDA search failed');
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify({ foods: data.foods || [] }) };

  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'usda_error', message: e.message }) };
  }
};
