# magma-content-site

MAGMA(3040 남성 패션 브랜드)의 회사소개 사이트 스타터입니다.
인프런 「Hermes × Codex 가상 오피스」 섹션 6(콘텐츠 블로그)과
섹션 7(데이터 실적 보고)이 이 저장소 위에서 진행됩니다.

이 저장소는 빈 앱이 아닙니다. 패션 브랜드 홈페이지처럼 보이는 기본 무대는
이미 준비되어 있고, 수강생은 아래 슬롯을 직접 채우면서 사이트를 완성합니다.

## 이미 준비된 무대

- 홈, 회사소개, 블로그, 실적 보고 페이지
- 패션 브랜드 톤의 다크 에디토리얼 디자인
- 마크다운 기반 블로그/리포트 렌더링
- `POST /api/posts` create-only 발행 API
- `PUT /api/posts/{slug}` 생성 또는 전체 교체 API
- Vercel 배포와 GitHub 커밋 발행을 위한 환경변수 구조

## 수강생이 채울 슬롯

| 실습 | 채울 자리 | 핵심 파일 |
| --- | --- | --- |
| 블로그 글 발행 | 새 글을 만들고 사이트 목록/상세에 노출 | `content/posts/*.md`, `POST /api/posts` |
| 데이터 자료 생성 | 실적 리포트를 만들고 실적 페이지에 노출 | `content/reports/*.md`, `collection: "reports"` |
| 히어로 영상 삽입 | 첫 화면 배경을 직접 만든 영상으로 교체 | `src/components/HeroMedia.tsx`, `public/hero.mp4` |
| 대시보드 임베드 | 실적 리포트에 BI 대시보드 연결 | `dashboardUrl` frontmatter |

## 준비물

- Node.js 20 이상 (`node -v` 로 확인)
- GitHub 계정
- Vercel 계정

## 처음 10분 체크리스트

1. GitHub에서 이 저장소를 Fork 하거나 Use this template으로 내 저장소를 만듭니다.
2. 내 컴퓨터로 clone 합니다.
3. 의존성을 설치합니다.
   ```bash
   npm ci
   ```
4. 개발 서버를 띄웁니다.
   ```bash
   npm run dev
   ```
5. 브라우저에서 http://localhost:3000 을 엽니다.
6. 설정 견본을 복사합니다.
   ```bash
   cp .env.example .env.local
   ```
7. 발행 API 키를 만듭니다.
   ```bash
   openssl rand -hex 32
   ```
8. `.env.local`의 `PUBLISH_API_KEY`에 붙여 넣습니다.
9. 배포 전 점검을 실행합니다.
   ```bash
   npm run preflight
   ```
10. Vercel에 배포한 뒤 `GITHUB_TOKEN`, `GITHUB_REPO`를 설정합니다.

## 구조 한눈에

```
site.config.ts         회사 정체성 (이름·태그라인·링크·CTA)
DESIGN.md              브랜드 디자인 정본 — 색·글꼴·사용 규칙
content/posts/         블로그 글 (마크다운 1파일 = 1글)
content/reports/       실적 보고 리포트 (마크다운)
src/lib/content.ts     글·리포트 읽기 (frontmatter 파싱·정렬·draft 제외)
src/lib/publish.ts     발행 API 내부 로직
src/app/api/posts/     발행 API 엔드포인트 (POST /api/posts, PUT /api/posts/{slug})
src/components/        Hero · HeroMedia · PostCard · ReportCard · DashboardEmbed
src/styles/tokens.css  DESIGN.md 를 코드로 옮긴 디자인 토큰
scripts/preflight.mjs  배포 전 점검 스크립트
```

## 글과 리포트 쓰기

블로그 글은 `content/posts/`, 실적 리포트는 `content/reports/`에 둡니다.
파일명이 곧 주소(slug)가 되므로 영문 소문자·숫자·하이픈만 사용합니다.

```markdown
---
title: "글 제목 (한글 가능)"
description: "목록에 보이는 한 줄 요약"
date: 2026-07-09
tags: [태그]
---

본문은 마크다운으로 씁니다.
```

실적 리포트에는 `period`와 `dashboardUrl`을 추가할 수 있습니다.

```markdown
---
title: "2026년 2분기 실적 요약"
description: "2분기 매출·채널·재고 요약입니다."
date: 2026-07-09
tags: [분기실적]
period: 2026-Q2
dashboardUrl: "https://lookerstudio.google.com/..."
---
```

`dashboardUrl`은 `<iframe>` HTML을 본문에 직접 넣는 대신 사용하는 안전한 대시보드 슬롯입니다.

## 발행 API

에이전트·자동화 도구는 `POST /api/posts`를 호출해 글이나 리포트를 발행합니다.

```bash
curl -X POST https://{내-배포-주소}/api/posts \
  -H "Authorization: Bearer {PUBLISH_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"첫 자동 발행","description":"발행 API 테스트","content":"본문입니다.","draft":false}'
```

같은 endpoint에서 기존 `POST`는 create-only이며, 같은 slug가 있으면 409를 반환합니다. 기존 콘텐츠를 만들거나 교체하려면 URL의 slug를 대상으로 PUT을 사용합니다.

```bash
curl -X PUT https://{내-배포-주소}/api/posts/my-first-post \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"title":"첫 자동 발행","description":"발행 API 테스트","content":"본문입니다.","tags":["테스트"],"date":"2026-09-29","draft":false}'
```

PUT은 전체 콘텐츠를 교체하므로 기존 데이터를 유지하려면 전체 필드를 보내야 합니다. URL slug가 대상이며, 본문에 `slug`를 포함하는 경우 URL slug와 같아야 합니다. 없으면 201로 생성하고, 있으면 200으로 전체 교체합니다. GitHub SHA 또는 동시 생성 충돌은 409로 중단되며 자동 재시도하지 않습니다.

실적 리포트는 `collection: "reports"`를 함께 보냅니다.

```json
{
  "collection": "reports",
  "title": "자동 생성 실적 리포트",
  "description": "데이터 분석 결과 요약",
  "period": "2026-Q2",
  "dashboardUrl": "https://lookerstudio.google.com/...",
  "content": "## 요약\n\n본문입니다.",
  "draft": false
}
```

| 응답 코드 | 의미 |
| --- | --- |
| 201 | `POST` 생성 성공 또는 `PUT` 신규 생성 — `collection`·`slug`·`url`·`mode` 반환 |
| 200 | `PUT` 기존 콘텐츠 전체 교체 성공 — 응답 필드는 기존 `PublishResult`와 동일 |
| 400 | `collection` 값이 `posts` 또는 `reports`가 아님 |
| 401 | 인증 키 불일치 |
| 409 | `POST` 대상 slug가 이미 있음 또는 `PUT` 저장소 충돌 |
| 422 | JSON·필수 필드·형식 오류, 잘못된 URL slug 또는 본문 slug 불일치 |
| 502 | GitHub 저장소 조회·저장 실패 |

로컬 개발(`NODE_ENV=development`)에서는 GitHub 환경변수의 유무와 관계없이 `content/<collection>/`에 파일을 직접 씁니다.
Vercel 배포 환경에서는 `GITHUB_TOKEN`과 `GITHUB_REPO`가 설정되어 있으면 GitHub Contents API로 커밋합니다.

## 히어로 영상 슬롯

홈 첫 화면은 지금도 브랜드 무드가 보이도록 그라디언트 배경이 들어가 있습니다.
섹션 6.5에서는 직접 만든 영상을 `public/hero.mp4`에 두고
`src/components/HeroMedia.tsx`의 TODO 슬롯을 영상 태그로 교체합니다.

## Vercel 배포

1. 내 GitHub 계정의 저장소를 Vercel에서 Import 합니다.
2. Environment Variables에 아래 값을 넣습니다.
   - `PUBLISH_API_KEY` — 직접 만든 긴 임의 문자열
   - `GITHUB_TOKEN` — fine-grained PAT (이 저장소 한정, Contents: Read and write)
   - `GITHUB_REPO` — `본인계정/본인저장소`
3. 필요할 때만 `NEXT_PUBLIC_DASHBOARD_HOST_ALLOWLIST`에 허용할 대시보드 호스트를 쉼표로 적습니다.
4. Deploy를 누릅니다.

중요: 수강생 배포에서는 `GITHUB_REPO`를 `dandacompany/magma-content-site`로 두지 않습니다.
반드시 본인 GitHub 저장소를 가리켜야 합니다.

## 문제가 생기면

| 증상 | 확인할 것 |
| --- | --- |
| `npm ci` 실패 | `node -v`가 20 이상인지 |
| 3000 포트 사용 중 | `PORT=3001 npm run dev` |
| 글이 목록에 안 보임 | frontmatter의 `title`·`description`·`date`, `draft: true` 여부 |
| 리포트 대시보드가 안 보임 | `dashboardUrl`이 http(s) URL인지, allowlist에 막히지 않았는지 |
| 발행 API 401 | Authorization 헤더와 `PUBLISH_API_KEY`가 같은지 |
| 발행 API 500 (배포) | `GITHUB_TOKEN`·`GITHUB_REPO`가 Vercel에 설정됐는지 |
| Google Fonts 오류 | 이 스타터는 외부 폰트 다운로드를 쓰지 않습니다. 이전 빌드 캐시가 의심되면 `.next`를 지우고 다시 빌드하세요. |
