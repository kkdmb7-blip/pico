// /api/saju-report.js
// Vercel Serverless Function - 사주 리포트 생성 (Claude Sonnet)

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { workerData } = body;

    if (!workerData) {
      return new Response(JSON.stringify({ error: 'workerData is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const {
      일간, 일주, 신강약, 용신,
      리포트, 대운분석, 월별운세, 유명인, 용신활용,
    } = workerData;

    const 기본 = 리포트?.기본 || '';
    const 조언 = 리포트?.조언 || '';
    const 올해운세 = 리포트?.올해운세 || '';
    const 연령대조언 = 리포트?.연령대조언 || '';

    const famousNames = (유명인?.유명인 || []).join(', ');
    const famousCommon = 유명인?.공통특성 || '';

    const yongsinUse = 용신활용?.활용법 || '';

    const daeunText = 대운분석
      ? `현재 대운: ${대운분석.대운 || ''} / 흐름: ${대운분석.흐름 || ''} / 조언: ${대운분석.조언 || ''}`
      : '';

    const monthlyText = 월별운세
      ? `이달 운세: ${월별운세.운세 || ''} / 조언: ${월별운세.조언 || ''}`
      : '';

    const systemPrompt = `주어진 사주 분석 데이터를 아래 구조로 자연스럽게 다듬어줘. 새로운 해석이나 판단은 절대 추가하지 말 것. 데이터에 있는 내용만 문장으로 정리할 것.

구조:
① 당신의 일주 (유명인 사례 포함)
② 타고난 기질과 강점
③ 지금 이 시기 (대운 흐름으로 위로)
④ 올해의 흐름 (2026 운세)
⑤ 당신의 용신 활용법
⑥ 이달의 운세
⑦ 행동 전략 (테마별 조언)

총 1500자 내외. 마크다운 사용.`;

    const userPrompt = `[사주 데이터]
일간: ${일간}
일주: ${일주}
신강약: ${신강약}
용신: ${용신}

[일주 기본 분석]
${기본}

[유명인]
${famousNames} / 공통특성: ${famousCommon}

[대운 분석]
${daeunText}

[올해 운세 2026]
${올해운세}

[용신 활용법]
${yongsinUse}

[이달의 운세]
${monthlyText}

[테마별 조언]
${조언}

[연령대 조언]
${연령대조언}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(JSON.stringify({ error: 'claude_error', detail: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await claudeRes.json();
    const report = data.content?.[0]?.text || '생성 실패';

    return new Response(JSON.stringify({ report }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
