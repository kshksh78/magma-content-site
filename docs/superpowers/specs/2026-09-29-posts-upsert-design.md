# POST 콘텐츠 upsert API 설계

작성일: 2026-09-29
상태: 설계 초안 — 구현 계획 전 사용자 검토 필요

## 배경과 목표

현재 `POST /api/posts`는 새 콘텐츠를 만들며, 대상 slug가 이미 있으면 HTTP 409를 반환한다. 같은 slug의 기존 글을 명시적으로 갱신해야 할 때 파일을 먼저 삭제하지 않고, 호출자가 upsert 의도를 드러내는 API가 필요하다.

목표는 생성과 교체를 명시적으로 지원하되 기존 POST 계약을 깨지 않는 것이다. 이 설계 범위는 사이트 저장소의 콘텐츠 발행 API이며, 발행 호출·게시 실행·기존 콘텐츠 삭제는 포함하지 않는다.

## 선택한 접근

별도 `PUT /api/posts/{slug}` 경로를 추가한다. 대안으로 `POST` 본문에 `mode: "upsert"`를 두는 방법은 생성 전용 POST 의미를 흐리므로 선택하지 않는다. 삭제 후 재게시 방식은 삭제와 생성 사이 실패 위험이 있어 선택하지 않는다.

`POST /api/posts`는 create-only로 유지한다. 이미 존재하는 slug에 대한 POST는 계속 409다.

## API 계약

### 요청

`PUT /api/posts/{slug}`는 `PUBLISH_API_KEY`의 기존 Bearer 인증을 사용한다. 경로 slug는 기존 slug 정규식 `^[a-z0-9]+(-[a-z0-9]+)*$`로 검증한다. 요청 본문은 기존 발행 API의 전체 콘텐츠 필드(`collection`, `title`, `description`, `content`, `tags`, `date`, `thumbnail`, `period`, `dashboardUrl`, `draft`)를 받는다. 부분 필드 병합은 지원하지 않는다.

경로 slug가 대상의 단일 기준이다. 본문에 `slug`가 제공되면 경로와 일치하는지 검증하고, 다르면 입력 오류로 거부한다. 생략은 허용한다.

### 결과

| 결과 | HTTP | 동작 |
|---|---:|---|
| 대상 slug가 없음 | 201 | 새 콘텐츠 생성 |
| 대상 slug가 있음 | 200 | 전달된 전체 원고로 교체 |
| 기존 POST 대상 slug가 있음 | 409 | 현행 create-only 충돌 응답 유지 |

성공 응답은 기존 `PublishResult` 모양인 `{collection, slug, url, mode, commitUrl?}`를 사용한다. HTTP 상태가 생성과 교체를 구분하므로 추가 응답 필드는 만들지 않는다.

인증 실패는 401, 잘못된 `collection`은 400, 필드 또는 slug 검증 오류는 422다. 저장소 오류는 오류 응답으로 반환한다. GitHub SHA 충돌 및 동시 생성 충돌은 409로 변환한다. 요청은 자동 재시도하지 않는다.

## 구성과 저장 흐름

- 새 Next.js 라우트 `src/app/api/posts/[slug]/route.ts`에 PUT 핸들러를 둔다.
- 기존 POST 인증, JSON 파싱, 입력 검증 및 응답 계약을 보존한다. 가능한 검증 로직은 공유하되 create-only와 upsert 저장 경로는 분리한다.
- `src/lib/publish.ts`에 경로 slug를 받는 upsert 저장 로직을 추가한다. `posts`와 `reports` 컬렉션 모두 기존 디렉터리 배치를 따른다.
- `NODE_ENV=development`에서는 `content/{collection}/{slug}.md`를 쓴다. 먼저 같은 디렉터리의 임시 파일에 완성된 Markdown을 쓴 후 rename하여 부분 파일이 노출되지 않게 한다. 임시 파일은 실패 시 정리한다.
- 배포 환경은 GitHub Contents API를 쓴다. 대상 조회가 404면 SHA 없이 생성하고, 200이면 반환된 SHA를 PUT에 포함해 교체한다. 조회 오류는 커밋하지 않고 중단한다. SHA 또는 동시 생성 충돌은 409로 반환하고 재시도하지 않는다.
- 두 저장 환경 모두 기존 frontmatter 생성 규칙을 사용한다. 응답의 `mode`는 `local` 또는 `github`이며, GitHub 성공이면 `commitUrl`을 포함한다.

## 보안·호환성

기존 `PUBLISH_API_KEY` 인증을 그대로 적용하고 키 값을 로그나 응답에 노출하지 않는다. 경로 slug 검증은 파일 경로 조작을 막기 위해 저장 전에 수행한다. 본문 slug와 경로 slug가 다르면 저장하지 않는다. PUT이 명시적 전체 교체인 만큼 호출자는 기존 데이터를 대체하려는 의도를 가진 요청이어야 한다.

## 검증 기준

- slug가 없는 경우 201 생성, 같은 slug가 있는 경우 200 전체 교체.
- PUT 호출 후 frontmatter와 본문이 요청 값으로 완전히 바뀌며, 누락한 선택 필드는 기존 글의 값이 남지 않는다.
- 같은 slug의 POST는 계속 409이고 파일을 변경하지 않는다.
- 잘못된 경로 slug, 경로와 다른 본문 slug, 필드 오류는 저장 전에 거부된다.
- 인증 실패는 401이며 파일/GitHub 상태를 바꾸지 않는다.
- GitHub 대상 없음은 SHA 없는 생성, 대상 있음은 SHA 포함 업데이트, GitHub 조회 오류·SHA 충돌은 재시도 없이 실패한다.
- 기존 발행 API 계약이 유지되고 ESLint와 프로덕션 빌드가 통과한다.

현재 저장소에는 전용 테스트 러너나 테스트 파일이 없다. 구현 계획에서는 새 의존성을 기본적으로 추가하지 않는 원칙을 유지하면서 위 동작을 검증할 실행 가능한 자동화 및 API smoke test 방법을 정한다.

## 구현 범위 밖

- 콘텐츠 삭제 API
- POST의 기존 동작 변경 또는 POST 재시도
- 부분 업데이트/PATCH
- 운영 발행 호출이나 `.env.local` 값 노출
- 현재 `fw2026-normal-mans-top5` 글을 실제로 갱신하는 작업
