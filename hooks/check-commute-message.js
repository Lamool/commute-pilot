#!/usr/bin/env node
/**
 * PreToolUse hook — 카카오톡 나챗방(KakaotalkChat-MemoChat) 전송 직전에 돈다.
 *
 * 「[출근 브리핑]」으로 시작하는 메시지만 검사한다. 다른 플러그인의 메시지는 그대로 통과시킨다.
 *
 * 막는 경우
 *   1. 200자를 넘는다 (나챗방 도구 한도)
 *   2. 첫 줄에 「기준」 시각이 없다
 *   3. SEOUL_API_KEY 값이 메시지에 들어 있다
 */

const PREFIX = '[출근 브리핑]';
const LIMIT = 200;

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `${reason}\n고쳐서 다시 보내세요.`,
    },
  }));
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const args = input.tool_input || {};
  const msg = Object.values(args).find((v) => typeof v === 'string' && v.startsWith(PREFIX));
  if (!msg) process.exit(0);

  if (msg.length > LIMIT) deny(`메시지가 ${msg.length}자입니다. ${LIMIT}자 이내로 줄이세요.`);
  if (!msg.split('\n')[0].includes('기준')) deny('첫 줄에 「… 기준」 시각이 없습니다.');
  const key = process.env.SEOUL_API_KEY;
  if (key && msg.includes(key)) deny('메시지에 API 키가 들어 있습니다.');
  process.exit(0);
});
