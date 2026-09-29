# AGENTS.md — 에이전트 작업 지도

이 저장소를 수정하는 AI 에이전트(헤르메스·Codex)를 위한 안내입니다.

## 역할

MAGMA(3040 남성 패션 브랜드)의 회사소개 사이트 스타터입니다.
홈·회사소개·블로그·실적 보고의 기본 무대는 이미 준비되어 있습니다.
에이전트는 이 무대를 허물지 말고, 수강생 실습 슬롯을 채우는 방식으로 작업합니다.

## 이미 완성된 무대

- Next.js + Tailwind v4 기반 페이지 구조
- 홈, 회사소개, 블로그 목록/상세, 실적 목록/상세
- 다크 에디토리얼 브랜드 토큰
- 마크다운 콘텐츠 파이프라인
- `POST /api/posts` create-only 발행 API
- `PUT /api/posts/{slug}` upsert 발행 API

## 수강생이 채우는 TODO 슬롯

| 슬롯 | 목적 | 주요 파일 |
| --- | --- | --- |
| 블로그 발행 | 새 글을 `content/posts`에 만들고 노출 | `content/posts/*.md`, `POST /api/posts` |
| 실적 리포트 발행 | 데이터 자료를 `content/reports`에 만들고 노출 | `content/reports/*.md`, `collection: "reports"` |
| 히어로 영상 | 홈 첫 화면 배경 영상을 삽입 | `public/hero.mp4` + `site.config.ts` 의 `hero.video` (컴포넌트 수정 불필요) |
| 대시보드 임베드 | 리포트에 BI 대시보드를 연결 | `dashboardUrl` frontmatter, `DashboardEmbed` |
| CTA/SNS | 외부 행동 유도 링크 활성화 | `site.config.ts`, `CtaSlot` |

## 수정 지점 지도

| 바꾸고 싶은 것 | 만지는 파일 |
| --- | --- |
| 회사 이름·태그라인·링크·CTA | `site.config.ts` |
| 색·글꼴·모서리 | `DESIGN.md` 먼저 고치고 → `src/styles/tokens.css` 반영 |
| 블로그 글 | `content/posts/*.md` 또는 발행 API |
| 실적 리포트 | `content/reports/*.md` 또는 발행 API `collection:"reports"` |
| 대시보드 iframe | 마크다운 raw HTML이 아니라 `dashboardUrl` 필드 |
| 히어로 배경 영상 | `site.config.ts` 의 `hero.video` (+ `public/hero.mp4`). 렌더 로직은 `HeroMedia.tsx` 가 자동 처리 |
| 룩북 이미지 자리 | `src/components/ImageSlot.tsx`를 쓰는 곳 |

## 지켜야 할 계약

1. **frontmatter 필드명 유지**: `title` `description` `date` `tags` `thumbnail` `draft` `period` `dashboardUrl`.
2. **slug 규칙 유지**: 파일명 = slug, `^[a-z0-9]+(-[a-z0-9]+)*$`.
3. **발행 API 계약 유지**: `collection`은 `posts`가 기본이고 `reports`도 허용한다. `POST /api/posts`는 create-only로 유지하며 같은 slug면 409다. `PUT /api/posts/{slug}`는 기존 필드 전체를 보내 생성(201) 또는 전체 교체(200)하며, 본문 slug가 있으면 경로 slug와 일치해야 한다. 인증 실패는 401, 입력 검증 오류는 400/422, 저장소 충돌은 409다. 성공 응답은 `{collection, slug, url, mode, commitUrl?}`다.
4. **대시보드 임베드 방식 유지**: 리포트 본문에 `<iframe>` raw HTML을 직접 넣지 말고 `dashboardUrl`을 사용합니다.
5. **외부 폰트 다운로드 금지**: 백지 환경 빌드를 위해 `next/font/google`을 쓰지 않습니다. 폰트는 `tokens.css`의 시스템 폰트 스택을 사용합니다.
6. **색상은 토큰 경유만**: 컴포넌트에 hex를 직접 쓰지 말고 `bg-canvas` `text-ink` `text-primary` `text-accent` 등 토큰 유틸리티를 사용합니다.
7. **의존성 추가 금지가 기본값**: 새 패키지가 필요하면 먼저 이유를 설명하고 승인받습니다.
8. **카피 톤**: 과장·느낌표 남발 금지. 패션 브랜드 무드는 `DESIGN.md`를 우선합니다.

## 발행 API의 환경별 동작

| 환경 | 저장 방식 |
| --- | --- |
| 로컬 dev (`NODE_ENV=development`) | GitHub 환경변수 유무와 관계없이 `content/<collection>/{slug}.md`에 직접 쓰기 |
| 배포(Vercel) | `GITHUB_TOKEN`·`GITHUB_REPO`가 있으면 GitHub Contents API로 `content/<collection>/{slug}.md` 커밋 → 자동 재배포 |

환경변수:

- `PUBLISH_API_KEY`: 발행 API 인증
- `GITHUB_TOKEN`: fine-grained PAT, 대상 repo Contents read/write
- `GITHUB_REPO`: 반드시 수강생 본인 `계정/저장소`
- `NEXT_PUBLIC_DASHBOARD_HOST_ALLOWLIST`: 선택, iframe 허용 호스트 제한

## 명령

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 (http://localhost:3000) |
| `npm run preflight` | Node/env/content 사전 점검 |
| `npm run lint` | ESLint |
| `npm run build` | 프로덕션 빌드 — 이 저장소의 기본 테스트 |

## 시각 완성도 원칙

이 스타터는 빈 와이어프레임이 아니라 패션 브랜드 홈페이지처럼 보여야 합니다.
다만 학생이 할 실습은 명확히 남겨야 합니다. 그래서 시각 무드는 유지하고,
히어로 영상·새 글·새 리포트·대시보드처럼 교체 가능한 슬롯을 선명하게 둡니다.
