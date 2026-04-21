# 개발 노트 (Development Notes)

## 1. 시스템 개요

IT Portal (IT 정보화 포탈)은 정보화 예산, 사업, 인력을 관리하는 내부 업무 시스템입니다.

- **사용자:** 약 3,000명의 사내 임직원
- **프론트엔드:** Nuxt 4 + PrimeVue + Tailwind CSS
- **백엔드:** Spring Boot + Oracle DB + JPA/QueryDSL

---

## 2. AI 하네스 구성

본 프로젝트는 4개의 AI 도구를 조합한 **Agentic Engineering 하네스**를 사용합니다.

```
┌─────────────────────────────────────────────────────────┐
│  gstack      — 브라우저 QA·리뷰·배포 슬래시 명령어      │
│  bkit PDCA   — 피처 단위 계획→실행→검증 워크플로우       │
│  ECC         — 스프링부트·Nuxt 패턴 스킬 라이브러리      │
│  Superpowers — 계획·디버깅·TDD 메타 워크플로우 스킬     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. gstack — 브라우저 기반 운영 명령어

gstack은 **슬래시 명령어 형태의 전문가 팀**입니다. 두 서버가 모두 기동된 상태에서 사용합니다.

```bash
# 서버 기동 (각각 별도 터미널)
cd it_backend  && ./gradlew bootRun
cd it_frontend && npm run dev
```

### 3.1 핵심 명령어

| 명령어 | 용도 | 사용 시점 |
|--------|------|-----------|
| `/qa` | 브라우저 자동화 품질 테스트 | 기능 구현 완료 후 |
| `/investigate` | 버그·500 오류 원인 분석 | 에러 발생 시 |
| `/review` | git diff 기준 코드 리뷰 | 커밋 전 |
| `/ship` | PR 생성 및 배포 | 배포 준비 완료 시 |
| `/health` | 코드 품질 전반 점검 | 주기적 품질 관리 |
| `/checkpoint` | 작업 상태 저장·복원 | 긴 작업 중간 저장 |

### 3.2 핵심 테스트 시나리오 (`/qa`)

- 로그인 → 프로젝트 조회/생성 → 결재 처리
- 테스트 대상: `http://localhost:3000`
- API 서버: `http://localhost:8080`

---

## 4. bkit PDCA — 피처 단위 구조화 개발

bkit은 **PDCA 방법론 기반 피처 개발 워크플로우**입니다. 계획→설계→실행→검증→아카이브 순으로 진행합니다.

### 4.1 기본 명령어

```bash
/pdca plan {기능 요구사항}    # 새 피처 시작 (계획 단계)
/pdca status                  # 현재 진행 상태 확인
/pdca next                    # 다음 단계로 이동
```

### 4.2 피처 진행 단계

```
plan → design → do → analysis → archive
 계획     설계    실행    검증       아카이브
```

### 4.3 생성 문서 위치

| 문서 | 경로 |
|------|------|
| 계획서 | `docs/01-plan/features/{feature}.plan.md` |
| 설계서 | `docs/02-design/features/{feature}.design.md` |
| 보고서 | `docs/04-report/{feature}.report.md` |
| 상태 파일 | `.bkit/state/pdca-status.json` |

### 4.4 현재 활성 피처

| 피처 | 단계 | 비고 |
|------|------|------|
| `rbac` | design | RBAC 설계 진행 중 |
| `entity` | do | 엔티티 구현 진행 중 |

---

## 5. ECC (Everything Claude Code) — 패턴 스킬 라이브러리

ECC는 **프레임워크별 Best Practice 스킬 모음**입니다 (v1.10.0). IT Portal에 직접 연관된 스킬:

### 5.1 백엔드 (Spring Boot)

```bash
/springboot-patterns       # 레이어드 아키텍처, JPA, 예외처리 패턴
/springboot-tdd            # Spring Boot TDD 워크플로우
/springboot-verification   # 구현 완료 후 검증 체크리스트
/springboot-security       # Spring Security, JWT, RBAC 패턴
/backend-patterns          # API 설계, 페이지네이션, 캐싱
/api-design                # REST API 설계 원칙
```

### 5.2 프론트엔드 (Nuxt 4)

```bash
/nuxt4-patterns            # Nuxt 4 컴포저블, 상태관리, 라우팅 패턴
/frontend-design           # UI/UX 컴포넌트 설계 원칙
/frontend-patterns         # Vue 3 Composition API 패턴
```

### 5.3 품질·보안

```bash
/tdd-workflow              # TDD 실천 워크플로우
/security-review           # OWASP Top 10, 보안 취약점 스캔
/plankton-code-quality     # 코드 품질 종합 분석
```

---

## 6. Superpowers — 메타 워크플로우 스킬

Superpowers는 **개발 방법론 수준의 워크플로우 스킬**입니다 (v5.0.7). 특정 작업 전 AI의 접근 방식 자체를 정의합니다.

| 스킬 | 용도 | 사용 시점 |
|------|------|-----------|
| `/brainstorm` | 아이디어 구체화·탐색 | 기능 구상 단계 |
| `/write-plan` | 구조화된 구현 계획 작성 | 복잡한 기능 착수 전 |
| `/execute-plan` | 작성된 계획 단계별 실행 | 계획 수립 후 |
| `/systematic-debugging` | 체계적 디버깅 워크플로우 | 원인 불명 버그 |
| `/test-driven-development` | TDD 강제 워크플로우 | 새 기능·버그픽스 |
| `/verification-before-completion` | 완료 전 최종 검증 | PR 생성 직전 |

---

## 7. IT Portal 에이전트 팀

풀스택 기능 개발 시 `it-portal` 스킬이 4개 에이전트를 오케스트레이션합니다.

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| `backend-dev` | `.claude/agents/backend-dev.md` | Spring Boot API 구현 |
| `frontend-dev` | `.claude/agents/frontend-dev.md` | Nuxt 4 UI 구현 |
| `security-rbac` | `.claude/agents/security-rbac.md` | RBAC 설계·검증 |
| `qa-reviewer` | `.claude/agents/qa-reviewer.md` | QA + 코드리뷰 |

---

## 8. 워크플로우 가이드

### 8.1 새 기능 개발 (풀스택)

```
1. /brainstorm {기능 아이디어}       ← Superpowers: 기능 구체화
2. /pdca plan {기능 요구사항}        ← bkit: 계획 수립
3. /springboot-patterns             ← ECC: 백엔드 패턴 참조
4. /nuxt4-patterns                  ← ECC: 프론트 패턴 참조
5. /pdca next                       ← bkit: 구현 단계 진입
6. /tdd-workflow                    ← ECC: TDD로 구현
7. /verification-before-completion  ← Superpowers: 완료 전 검증
8. /qa                              ← gstack: 브라우저 테스트
9. /review                          ← gstack: 코드 리뷰
10. /ship                           ← gstack: PR 배포
```

### 8.2 버그 수정

```
1. /investigate                     ← gstack: 원인 분석
2. /systematic-debugging            ← Superpowers: 체계적 디버깅
3. /test-driven-development         ← Superpowers: 테스트 먼저 작성
4. /qa                              ← gstack: 회귀 테스트
```

### 8.3 코드 품질 점검

```
1. /health                          ← gstack: 전반적 품질
2. /security-review                 ← ECC: 보안 취약점
3. /plankton-code-quality           ← ECC: 코드 품질 분석
```

### 8.4 정기 정비

| 작업 | 시작 방법 |
|------|-----------|
| 전체 코드·구조 정비 | `REVIEW.md 진행해줘` |
| 테스트 코드 작성 | `TEST.md 진행해줘` |
| 코드 간결화 | `/simplify 하위 디렉토리 포함` |

---

## 9. Health Stack (빠른 품질 확인)

```bash
# 타입 체크
cd it_frontend && npx nuxt typecheck

# 린트
cd it_frontend && npx eslint .

# 프론트엔드 단위 테스트
cd it_frontend && npx vitest run

# 백엔드 테스트
cd it_backend && ./gradlew test
```

---

## 10. 기타 프로젝트 스킬

| 스킬 | 용도 |
|------|------|
| `/fp` | 정통법 기능점수(FP) 산정 |
