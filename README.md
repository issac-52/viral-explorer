# 엑싯바이럴 · ExitViral

한국어·일본어·영어 후기에서 협찬 고지와 관련된 문구, 그리고 제휴(수수료)·체험단 플랫폼 링크를 찾아 원문 그대로 표시하는 개발 버전입니다. 표시 언어와 분석 대상 언어는 독립적입니다. 공개 네이버 블로그·티스토리·WordPress.com·DEV 게시물 URL 또는 직접 붙여넣은 텍스트에 명시적인 표현 규칙을 적용하고, AI 키가 설정되어 있으면 규칙으로 확정되지 않은 글만 AI가 문맥을 한 번 더 읽습니다.

## 로컬 실행

Node.js 24 및 npm 환경에서 실행합니다.

```sh
npm ci
npm test
npm run dev
```

표시된 로컬 주소(기본 http://localhost:8787)를 엽니다. dev 명령이 TypeScript 검사, Vite 빌드 및 로컬 D1 마이그레이션을 수행합니다. 프런트엔드 변경 후에는 다시 빌드하세요. Cloudflare 계정이나 유료 API 키 없이 로컬에서 실행됩니다.

## API

- POST /api/analyses — JSON 본문 `{"text":"후기 내용"}`. 최대 20,000 UTF-16 코드 단위. 최초 저장 시 201, 재사용 시 200.
- 같은 POST 경로에 `{"url":"https://blog.naver.com/블로그ID/글번호"}`로 요청하면 모바일 페이지의 robots.txt를 확인한 뒤 본문을 추출합니다. 리디렉션, 비공개 글, 읽을 수 없는 본문은 HTTP 422로 응답하며 화면에서 본문 직접 입력을 안내합니다. URL 요청 시 원문을 다시 읽고 같은 본문은 기존 분석 결과를 재사용합니다.
- 응답의 `ai`는 AI 문맥 분석 결과입니다. AI를 쓰지 않았거나 실패했으면 `null`입니다.
- GET /api/analyses/{id} — 저장된 ID와 인용 문구 배열을 반환합니다. 결과 주소를 가진 사람은 인용 문구를 열람할 수 있습니다.

### 제휴·체험단 링크

URL로 가져온 글은 본문 안의 링크(`a[href]`)를, 붙여넣은 본문은 텍스트에 포함된 `http(s)://` 주소를 확인합니다. `worker/links.ts`의 목록에 있는 호스트만 표시합니다.

- 제휴 링크: 쿠팡 파트너스 단축 링크, Amazon `tag` 파라미터, AliExpress·Rakuten·もしも·A8.net·Rakuten Advertising·ShareASale
- 체험단 플랫폼 링크: 레뷰, 리뷰노트, 디너의여왕, 포블로그, 미블, 서울오빠

네이버 블로그의 체험단 배너는 대부분 이미지라 본문 텍스트에 고지 문구가 없는 경우가 많습니다. 배너에 걸린 플랫폼 링크가 그때 남는 단서입니다. 결과에는 호스트와 경로만 표시하고 쿼리 문자열은 버립니다. 링크만으로 협찬을 단정하지 않으며 화면에도 그렇게 안내합니다. 호스트 목록은 운영하면서 실제 글을 보고 검증·추가해야 합니다.

D1에는 원문 전체 대신 규칙 버전을 포함한 본문 해시, 임의 결과 ID, 일치한 표현과 같은 문단의 앞뒤 발췌(앞 48자, 뒤 72자 이내), 생성 시각을 저장합니다. 가져온 글의 링크 결과도 해시 입력에 포함됩니다. 광고 여부 확률을 산출하지 않습니다. wrangler.jsonc의 데이터베이스 UUID는 로컬 개발용입니다. 운영 배포에는 실제 D1 연결과 원격 마이그레이션이 필요합니다.

## AI 문맥 분석

규칙이 작성자의 직접 고지를 이미 찾은 글은 AI를 호출하지 않습니다. 규칙이 아무것도 찾지 못했거나, 찾은 표현이 모두 인용·부정·일반 설명 가능성으로 표시된 경우에만 AI가 본문을 읽습니다.

- AI는 `disclosed`(작성자 고지 있음) / `none` / `unclear`(직접 밝히지 않았지만 상업적 관계가 의심됨) 중 하나와, `disclosed`일 때 원문 인용을 돌려줍니다.
- 인용은 원문에 글자 그대로 있어야 합니다. 원문에 없는 문장을 돌려주면 AI 결과 전체를 버립니다. 그래서 화면의 근거는 항상 원문 일부입니다.
- 결과는 규칙 버전·모델·프롬프트 버전을 포함한 키로 D1에 캐시합니다. 같은 본문은 한 번만 호출합니다. AI 호출이 실패하면 결과는 저장하지만 캐시로 재사용하지 않아, 다음 요청에서 다시 시도합니다.
- 키가 없으면 AI 없이 규칙만으로 동작합니다. 로컬 실행에 유료 키가 필요하지 않습니다.

설정은 OpenAI 호환 Chat Completions API를 사용합니다. 모델과 주소는 `wrangler.jsonc`의 `vars`(`AI_MODEL`, `AI_BASE_URL`)에서 바꿉니다. 키는 비밀 값으로 등록합니다.

```sh
npx wrangler secret put AI_API_KEY
```

로컬에서는 저장소 루트에 `.dev.vars` 파일을 만들고 `AI_API_KEY=...`를 넣습니다(Git에 올라가지 않습니다). 프롬프트는 `worker/ai.ts`에 있으며, 바꾸면 `aiPromptVersion`을 올리세요. 이 변경에는 D1 마이그레이션 `0002_ai.sql`(nullable 컬럼 추가)이 포함되어 있어, 배포 순서(마이그레이션 → 배포)를 그대로 따르면 됩니다.

## 규칙과 LLM 비교 실험

`node eval/run.mjs`는 실제 서비스 규칙을 사용해 한국어·일본어·영어 사례의 오탐과 누락을 집계합니다. 한국어 고지 7개·비고지 7개, 일본어와 영어 각각 고지 5개·비고지 5개입니다. 비고지에는 부정, 타인 인용, 가정(“받고 싶어요”), 제도 설명, 일반 후기가 들어 있습니다. 직접 작성한 짧은 진단 사례이며 실사용 빈도를 대표하지 않습니다.

`node eval/run.mjs --llm`은 같은 본문 34개를 운영과 같은 프롬프트(`worker/ai.ts`)로 한 번씩 보내고 원문 인용을 검증합니다. 셸 환경에 AI_API_KEY(기존 OPENAI_API_KEY도 인식), EVAL_INPUT_USD_PER_M, EVAL_OUTPUT_USD_PER_M을 설정하세요. 단가는 해당 모델의 입력·출력 100만 토큰당 달러입니다. 기본 모델은 gpt-4o-mini이고 AI_MODEL(또는 EVAL_MODEL)로 변경할 수 있습니다. 실행할 때마다 비용이 발생할 수 있습니다. 오류 시 자동 재시도 없이 중단합니다. usdPer1000은 이 길이의 후기를 전부 API로 분석할 때의 토큰 비용 추정치이며, 실제 트래픽에서는 호출 비율과 본문 길이에 따라 달라집니다.

## Cloudflare 첫 배포

1. Cloudflare 무료 계정을 준비하고 Node.js 24와 Git을 설치합니다. 저장소를 받아 의존성을 설치합니다.

   ```sh
   git clone https://github.com/issac-52/viral-explorer.git
   cd viral-explorer
   npm ci
   npm test
   npm run build
   ```

2. 터미널에서 로그인하고 대상 계정을 확인합니다.

   ```sh
   npx wrangler login
   npx wrangler whoami
   ```

3. 운영 D1을 한 번 생성합니다. 한국·일본 사용자를 고려해 아시아 태평양 위치를 요청합니다. 이미 만들었다면 `npx wrangler d1 list`에서 기존 ID를 확인합니다.

   ```sh
   npx wrangler d1 create exitviral --location apac --update-config=false
   ```

4. 저장소 루트의 `wrangler.jsonc`에서 기존 `database_id` 값을 위 출력의 UUID로 교체하고 저장합니다. 바인딩 이름은 `DB`입니다. 계정에 다른 Worker가 rate limiting namespace 1001을 사용한다면 이 앱의 namespace_id를 별도 숫자 문자열로 지정합니다.

5. 운영 D1에 테이블을 만든 뒤 배포합니다. Wrangler가 workers.dev 서브도메인 등록을 안내하면 이 계정에서 사용할 이름을 선택합니다.

   ```sh
   npx wrangler d1 migrations apply DB --remote
   npx wrangler deploy
   ```

6. 출력된 workers.dev 주소에서 “제품을 제공받아 작성했어요”를 분석합니다. 결과에 원문 표현이 뜨고 결과 주소를 새로고침한 뒤에도 같은 결과가 나오면 정적 화면, Worker, 운영 D1이 연결된 상태입니다. 이후 업데이트 시 빌드 → 운영 마이그레이션 → 배포 순서를 따릅니다.

분석 POST에는 Cloudflare 위치별로 IP당 60초에 20회 제한이 적용됩니다. 공유 IP의 사용자는 한도를 공유합니다. 전체 계정 사용량은 Cloudflare 대시보드의 Workers 및 D1 사용량에서 확인하세요. 공개 베타에는 Workers Free와 기본 workers.dev 주소로 시작할 수 있습니다.

### 문맥 단서 평가

`node eval/run.mjs --public`는 출처가 기록된 한국어 발췌 3개(직접 고지 1개, 체험단 설명 2개)를 점검합니다. 직접 고지 후보는 인용·부정·일반 설명 단서가 붙지 않은 문구입니다. 화면에는 모든 근거를 남깁니다. 이 사례들은 규칙을 만들 때 본 예시이며 독립 검증 자료가 아닙니다. 과거 결과에는 당시 저장된 문구를 표시하고 새 분석에 새 규칙을 적용합니다.

## GitHub main 자동 배포

기존 exitviral Worker에서 **Settings → Builds → Connect**를 열고 GitHub 저장소 `issac-52/viral-explorer`를 선택합니다. 루트는 저장소 최상위, 운영 브랜치는 main으로 지정합니다. 비운영 브랜치 빌드는 끕니다.

- Build command — `npm run build:cloudflare`
- Deploy command — `npm run deploy:cloudflare`
- Build variables — `D1_DATABASE_ID`에 기존 운영 D1의 UUID를 입력합니다(대시보드의 D1 → exitviral). 빌드용 배포 토큰에는 해당 계정의 Workers Scripts 편집 및 D1 편집 권한이 필요합니다.

이후 main 푸시 시 테스트와 프런트 빌드를 거쳐 실제 D1 바인딩으로 마이그레이션 및 배포합니다. 첫 실행은 Builds 로그와 배포된 커밋으로 확인합니다. 배포 전 적용하는 DB 변경은 이전 Worker와 호환되게 작성하세요.

## 입력 소스 확장 방향

현재 네이버 블로그, *.tistory.com, 단일 하위 도메인의 *.wordpress.com 및 dev.to의 공개 HTTPS 글 링크와 한·일·영 본문 붙여넣기를 지원합니다. 다음 대상은 Google 검색 결과에서 사용자가 선택한 공개 웹 문서의 원문 URL입니다. 사이트별 본문 추출과 접근 정책을 검증한 뒤 범위를 넓힙니다. 영상은 설명란과 이용 가능한 자막을 구분해서 분석하고, 자막 근거에는 해당 시점을 함께 표시하는 방향입니다.
