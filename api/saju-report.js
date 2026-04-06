// /api/saju-report.js
// Vercel Serverless Function (nodejs) - 사주 리포트 생성

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { workerData, selectedThemes = [], mainConcern = '' } = req.body;

    if (!workerData) {
      return res.status(400).json({ error: 'workerData is required' });
    }

    const {
      일간, 일주, 신강약, 용신,
      리포트, 대운분석, 월별운세, 유명인, 용신활용, 관계공략,
    } = workerData;

    const 기본 = 리포트?.기본 || {};
    const 조언 = 리포트?.조언 || {};
    const 올해운세 = 리포트?.올해운세 || {};
    const 연령대조언 = 리포트?.연령대조언 || null;

    const famousNames = (유명인?.유명인 || []).join(', ');
    const famousCommon = 유명인?.공통특성 || '';
    const yongsinUse = 용신활용?.활용법 || '';

    const daeunText = 대운분석
      ? `대운특성: ${대운분석.대운특성 || ''} / 상승대운: ${대운분석.상승대운 || ''} / 전환점: ${대운분석.전환점 || ''}`
      : '';

    const monthlyText = 월별운세
      ? `월건: ${월별운세.월건 || ''} / 운세: ${월별운세.운세 || ''} / 조언: ${월별운세.조언 || ''}`
      : '';

    const relationText = 관계공략
      ? `상대방 일주 공략법: ${관계공략.공략법 || ''}`
      : '';

    let emphasisGuide = '';
    if (selectedThemes.length > 0) {
      emphasisGuide += `\n관심 테마: ${selectedThemes.join(', ')} - ⑦ 행동 전략 섹션에서 이 테마 관점으로 조언할 것.`;
    }
    if (mainConcern) {
      emphasisGuide += `\n주요 고민: ${mainConcern} - 해당 고민에 대한 사주 기반 조언을 ⑦에서 우선 다룰 것.`;
    }

    const systemPrompt = `주어진 사주 분석 데이터를 아래 구조로 자연스럽게 다듬어줘. 새로운 해석이나 판단은 절대 추가하지 말 것. 데이터에 있는 내용만 문장으로 정리할 것.

구조:
① 당신의 일주 (유명인 사례 포함)
② 타고난 기질과 강점
③ 지금 이 시기 (대운 흐름으로 위로)
④ 2026년 올해의 흐름
⑤ 당신의 용신 실생활 활용법
⑥ 이달의 운세
⑦ 맞춤 행동 전략 (테마별 조언)${관계공략 ? '\n⑧ 상대방 일주 관계 공략법' : ''}

총 1200자 내외. 마크다운 사용(## 섹션 제목, **강조**). 따뜻하고 현실적인 톤.${emphasisGuide}`;

    const userPrompt = `[사주 기본 정보]
일간: ${일간} / 일주: ${일주} / 신강약: ${신강약} / 용신: ${용신}

[일주 분석]
성격: ${기본.성격 || ''}
재물운: ${기본.재물운 || ''}
직업운: ${기본.직업운 || ''}

[유명인] ${famousNames} / ${famousCommon}

[대운] ${daeunText}

[올해 운세] 키워드: ${올해운세.키워드 || ''} / ${올해운세.분석 || ''}

[용신 활용] ${yongsinUse}

[이달] ${monthlyText}

[조언] 창업: ${조언['창업/비즈니스'] || ''} / 이직: ${조언['이직/커리어'] || ''} / 투자: ${조언['투자/재테크'] || ''} / 대인관계: ${조언['대인관계/부부'] || ''}

${연령대조언 ? '[연령대] ' + 연령대조언.연령대 + ': ' + 연령대조언.조언 : ''}
${relationText}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return res.status(500).json({ error: 'claude_error', detail: err });
    }

    const data = await claudeRes.json();
    const report = data.content?.[0]?.text || '생성 실패';

    return res.status(200).json({ report });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
