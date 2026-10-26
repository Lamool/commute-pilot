#!/usr/bin/env node
/**
 * 서울 지하철 실시간 도착정보 MCP 서버 (stdio, 의존성 없음).
 * 도구: get_subway_arrival(station, limit?)
 *
 * 키는 환경변수 SEOUL_API_KEY 로만 받는다. 응답·오류 어디에도 키를 싣지 않는다.
 */

const KEY = process.env.SEOUL_API_KEY;
const BASE = 'http://swopenapi.seoul.go.kr/api/subway';

// subwayId -> 노선명. 목록에 없는 코드는 원문 그대로 둔다
const LINES = {
  1001: '1호선', 1002: '2호선', 1003: '3호선', 1004: '4호선', 1005: '5호선',
  1006: '6호선', 1007: '7호선', 1008: '8호선', 1009: '9호선',
  1063: '경의중앙선', 1065: '공항철도', 1067: '경춘선', 1075: '수의분당선',
  1077: '신분당선', 1092: '우이신설선', 1032: 'GTX-A',
};

const TOOL = {
  name: 'get_subway_arrival',
  description: '서울 지하철 역 이름으로 실시간 도착정보를 조회한다. 역 이름에 「역」은 빼고 넣는다 (예: 강남).',
  inputSchema: {
    type: 'object',
    properties: {
      station: { type: 'string', description: '역 이름 (예: 강남)' },
      limit: { type: 'integer', description: '최대 건수 (기본 8)', minimum: 1, maximum: 20 },
    },
    required: ['station'],
  },
};

async function getArrival({ station, limit = 8 }) {
  if (!KEY) throw new Error('SEOUL_API_KEY 가 설정되지 않았습니다.');
  const name = String(station).replace(/역$/, '').trim();
  if (!name) throw new Error('역 이름이 비어 있습니다.');

  const url = `${BASE}/${KEY}/json/realtimeStationArrival/0/${limit}/${encodeURIComponent(name)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`서울시 API 응답 오류: HTTP ${res.status}`);
  const data = await res.json();

  // 정상이면 realtimeArrivalList, 오류면 {status, code, message} 형태로 온다
  const list = data.realtimeArrivalList;
  if (!list) throw new Error(`서울시 API: ${data.message || data.code || '알 수 없는 응답'}`);

  const now = Date.now();
  return list.map((r) => {
    // recptnDt 는 서울 시각(KST)이라 offset 을 명시해서 파싱한다
    const age = Math.round((now - Date.parse(r.recptnDt.replace(' ', 'T') + '+09:00')) / 1000);
    return {
      line: LINES[r.subwayId] || r.subwayId,
      direction: r.trainLineNm,
      message: r.arvlMsg2,
      seconds: Number(r.barvlDt) || null, // updated 시점 기준 남은 초
      updated: r.recptnDt,
      age_seconds: Number.isFinite(age) ? Math.max(age, 0) : null, // 지금 기준 남은 초 = seconds - age_seconds
      terminal: r.bstatnNm,
    };
  });
}

// --- 최소 JSON-RPC (줄 단위 JSON) ---
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return; // notification 은 응답하지 않는다

  try {
    if (method === 'initialize') {
      return send({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: params?.protocolVersion || '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'subway', version: '0.1.0' },
        },
      });
    }
    if (method === 'tools/list') {
      return send({ jsonrpc: '2.0', id, result: { tools: [TOOL] } });
    }
    if (method === 'tools/call') {
      if (params?.name !== TOOL.name) throw new Error(`알 수 없는 도구: ${params?.name}`);
      try {
        const rows = await getArrival(params.arguments || {});
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(rows) }] } });
      } catch (e) {
        return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: e.message }] } });
      }
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch { /* 깨진 줄은 무시 */ }
  }
});
