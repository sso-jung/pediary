// src/lib/aiClient.js
export async function requestPediaryAiSummary(payload) {
  const res = await fetch(
    import.meta.env.VITE_PEDIAIY_AI_ENDPOINT, // 예: Supabase Function URL
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    throw new Error('AI 분석 요청 실패');
  }

  return res.json(); // PediaryAiResponse
}
