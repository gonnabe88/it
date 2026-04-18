---
name: it-portal
description: |
  IT Portal 개발 오케스트레이터. 백엔드(Spring Boot 4)/프론트엔드(Nuxt 4)/보안(RBAC)/QA 에이전트 팀을 조율하여 기능을 end-to-end로 구현한다.
  다음 요청 시 반드시 이 스킬을 사용한다:
  - 새 기능 개발, API + UI 동시 구현 요청
  - RBAC/권한 관련 설계·구현·검증
  - 백엔드 API 또는 프론트 페이지 개발
  - 전체 기능 QA, 코드 리뷰 요청
  - "다시 실행", "재실행", "업데이트", "이전 결과 기반", "이어서 개발"
  Do NOT use for: 단순 질문, 파일 하나 수정, 하네스 설정 변경.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - TaskCreate
  - TaskUpdate
  - TaskGet
  - SendMessage
  - TeamCreate
  - TeamDelete
---

# IT Portal 개발 오케스트레이터

## 에이전트 팀 구성
| 에이전트 | 파일 | 역할 |
|---------|------|------|
| backend-dev | `.claude/agents/backend-dev.md` | Spring Boot API 개발 |
| frontend-dev | `.claude/agents/frontend-dev.md` | Nuxt 4 UI 개발 |
| security-rbac | `.claude/agents/security-rbac.md` | RBAC 설계·검증 |
| qa-reviewer | `.claude/agents/qa-reviewer.md` | QA + 코드리뷰 |

**실행 모드:** 에이전트 팀 (기본)

## Phase 0: 컨텍스트 확인

워크플로우 시작 시 기존 작업 상태를 확인한다.

```
_workspace/ 디렉토리 존재 여부 확인:
- 없음 → 초기 실행
- 있음 + 부분 수정 요청 → 부분 재실행 (해당 에이전트만 재호출)
- 있음 + 새 입력 제공 → 새 실행 (_workspace를 _workspace_prev/로 이동)
```

## Phase 1: 요구사항 분석 및 팀 구성

1. 사용자 요청에서 작업 유형을 파악한다:
   - **백엔드 단독**: backend-dev만 실행
   - **프론트 단독**: frontend-dev만 실행
   - **풀스택**: backend-dev + frontend-dev 병렬 + security-rbac 검토 + qa-reviewer
   - **RBAC 설계**: security-rbac 주도 + backend-dev + frontend-dev 적용
   - **QA/리뷰**: qa-reviewer 단독

2. 관련 설계 문서 확인 (존재 시):
   - `docs/02-design/` 또는 `.bkit/` 하위 design 문서
   - 현재 rbac 피처의 경우 RBAC 설계서 참조

3. `_workspace/` 디렉토리 생성:
   ```
   _workspace/
   ├── api-spec.md      (backend-dev → frontend-dev)
   ├── rbac-design.md   (security-rbac 산출물)
   └── qa-report.md     (qa-reviewer 산출물)
   ```

## Phase 2: 구현 (에이전트 팀)

### 풀스택 개발 시 팀 구성 예시
```
TeamCreate(
  members: [backend-dev, frontend-dev, security-rbac, qa-reviewer],
  tasks: [
    {id: 1, agent: security-rbac, title: "RBAC 설계 검토"},
    {id: 2, agent: backend-dev, title: "API 구현", depends_on: [1]},
    {id: 3, agent: frontend-dev, title: "UI 구현", depends_on: [2]},
    {id: 4, agent: qa-reviewer, title: "QA 실행", depends_on: [3]}
  ]
)
```

### 데이터 전달 프로토콜
- **security-rbac → backend-dev**: `_workspace/rbac-design.md`
- **backend-dev → frontend-dev**: `_workspace/api-spec.md`
- **모든 에이전트 → 오케스트레이터**: SendMessage로 완료 보고
- **이슈 발생 시**: 담당 에이전트에게 SendMessage 직접 전달

## Phase 3: QA 검증

qa-reviewer가 다층 검증 수행:
1. `cd it_frontend && npx nuxt typecheck` 타입 체크
2. `cd it_frontend && npx vitest run` 단위 테스트
3. `cd it_backend && ./gradlew test` 백엔드 테스트
4. gstack 브라우저 테스트 (localhost:3000)
   - 골든 패스: 로그인 → 프로젝트 조회/생성 → 결재 처리
   - RBAC: 역할별 메뉴/버튼 표시 확인

결과를 `_workspace/qa-report.md`에 저장.

## Phase 4: 결과 보고

모든 Phase 완료 후:
- 구현된 파일 목록
- QA 결과 요약 (Pass/Fail)
- 발견된 이슈 및 조치 내역
- 후속 작업 제안

## 에러 핸들링
- 에이전트 실패 시 1회 재시도
- 재실패 시 해당 결과 없이 진행 + 보고서에 누락 명시
- 보안 이슈 발견 시 즉시 사용자에게 에스컬레이션 (다음 Phase 진행 중단)

## 테스트 시나리오

### 정상 흐름 — RBAC 기능 구현
1. security-rbac가 역할 설계 검토 → `_workspace/rbac-design.md` 생성
2. backend-dev가 API 구현 → Spring Security 설정 + @PreAuthorize 적용
3. frontend-dev가 미들웨어/레이아웃 적용 → 역할별 UI 보호
4. qa-reviewer가 역할별 접근 테스트 + 코드 리뷰

### 에러 흐름 — 보안 이슈 발견
1. qa-reviewer가 admin API에 @PreAuthorize 누락 발견
2. security-rbac에게 SendMessage로 이슈 전달
3. backend-dev가 즉시 수정 → 재테스트
