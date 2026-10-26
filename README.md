# commute-pilot

서울 지하철 실시간 도착정보를 읽어 "지금 나가도 되는지"를 알려 주는 Claude Code 플러그인이에요.
역 이름과 걸어가는 시간을 말하면 탈 수 있는 열차와 놓칠 열차를 나눠 보여 주고, 요청하면 카카오톡 나챗방으로도 보내요.

```
[출근 브리핑] 15:40 기준
- 추천 1: 2호선 성수행(교대방면) 약 3분 25초 후 (걸어서 3분이면 25초 여유)
- 추천 2: 2호선 성수행(역삼방면) 약 6분 15초 후
- 놓침: 역삼방면 "전역 도착" 열차
출처: 서울 열린데이터광장
```

## 구성

| 요소 | 위치 | 역할 |
|------|------|------|
| OpenAPI | 서울 열린데이터광장 | 지하철 실시간 도착정보 (`realtimeStationArrival`) |
| MCP | `server/index.js`, `.mcp.json` | API 를 `get_subway_arrival` 도구로 감싼 서버 (Node, 의존성 없음) |
| Skill | `skills/commute-brief/` | 조회, 계산, 출력 형식 절차 |
| Agent | `agents/route-advisor.md` | 걸어가는 시간과 비교해 추천 1~2개와 놓칠 열차 선택 |
| Hook | `hooks/check-commute-message.js` | 카톡 전송 직전 검사 (200자 초과, `기준` 시각 누락, API 키 노출 차단) |

## 준비

- Claude Code
- Node.js (MCP 서버 실행용, `fetch` 가 내장된 버전)
- 서울 열린데이터광장 인증키: https://data.seoul.go.kr 에서 신청해요. 실시간 지하철 API 용 키가 필요해요.
- 카카오톡 전송을 쓰려면 claude.ai 에 연결한 PlayMCP 커넥터의 `KakaotalkChat-MemoChat` 이 필요해요.
  이 플러그인은 카톡용 서버를 따로 두지 않아요. 전송 대상은 사용자 본인의 나챗방이에요.

## 설치

```powershell
claude plugin marketplace add Lamool/commute-pilot
claude plugin install commute-pilot@commute-pilot
```

내 PC 에 받아 둔 폴더로도 설치할 수 있어요.

```powershell
claude plugin marketplace add C:\경로\commute-pilot
claude plugin install commute-pilot@commute-pilot
```

## API 키 설정

키는 환경변수 `SEOUL_API_KEY` 로만 받아요. 코드와 저장소에는 넣지 않아요.

```powershell
# 현재 PowerShell 창에서만
$env:SEOUL_API_KEY="발급받은키"

# 계속 쓰려면 (새로 여는 창부터 적용)
[Environment]::SetEnvironmentVariable("SEOUL_API_KEY", "발급받은키", "User")
```

키를 설정한 창에서 `claude` 를 실행해야 MCP 서버가 키를 받아요. `.env.example` 은 자리만 표시한 파일이에요.

## 사용법

말로 요청하면 돼요.

- "강남역 출근 브리핑 해줘, 걸어서 3분"
- "서울역에서 출발할 건데 5분 걸어가야 해. 지금 나가도 돼?"
- "사당역 열차 몇 분 뒤에 와?"
- "강남 출근 브리핑, 걸어서 2분, 카톡으로 보내줘"

Skill 을 직접 부를 수도 있어요.

```
/commute-pilot:commute-brief 강남역, 걸어서 3분
```

| 입력 | 필수 | 설명 |
|------|------|------|
| 출발역 | 필수 | "강남", "서울역" 처럼. 뒤의 "역" 은 서버가 떼요 |
| 걸어가는 시간 | 선택 | 없으면 놓침 판단 없이 도착 순서만 알려 줘요 |
| 카톡 전송 | 선택 | 요청할 때만 보내요 |

## 알아둘 점

- 하루 호출 한도는 1,000건이에요 (실시간 지하철 API 기준).
- 남은 시간은 `seconds - age_seconds` 로 계산해요. `seconds` 는 `updated` 시점 기준이라 그대로 쓰면 어긋나요.
- 일부 구간(수도권 1호선, 8호선 등)은 초 단위 값 없이 "N번째 전역" 만 와요.
  이런 열차는 남은 시간을 지어내지 않고 추천에서 빼요.
- 실시간 정보라 지연이나 누락이 있을 수 있어요. 여유가 30초 안팎이면 놓친다고 보는 게 안전해요.
- 지하철만 지원해요. 버스는 없어요.

## 문제 해결

- `SEOUL_API_KEY 가 설정되지 않았습니다` : 환경변수를 설정한 뒤 새 PowerShell 에서 `claude` 를 다시 여세요.
- 도구가 안 보여요 : `claude plugin list` 에서 `commute-pilot` 이 enabled 인지 확인하세요.
- 카톡 전송이 막혀요 : Hook 이 200자 초과, 첫 줄의 `기준` 시각 누락, 키 포함 메시지를 막아요. 문구를 고쳐 다시 보내세요.

## 구조

```
commute-pilot/
├─ .claude-plugin/
│  ├─ plugin.json          # 플러그인 정보, Hook 등록
│  └─ marketplace.json     # 마켓플레이스 목록
├─ .mcp.json               # MCP 서버 등록 (키는 ${SEOUL_API_KEY})
├─ server/index.js
├─ skills/commute-brief/SKILL.md
├─ agents/route-advisor.md
├─ hooks/check-commute-message.js
├─ .env.example
└─ .gitignore
```
