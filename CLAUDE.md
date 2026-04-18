---
[ 프로젝트 메인 가이드 ]
본 파일은 IT Portal System의 개발 환경, 기술 스택, 코딩 표준을 정의합니다.
AI 어시스턴트는 코드 생성 시 이 지침을 준수하며, 모든 주석은 한글로 작성합니다.
---

## 1. 프로젝트 개요
- 명칭: IT Portal System (IT 정보화사업 관리 시스템)
- 주요 기능: 정보화사업 및 전산예산 프로젝트 관리
- 사용자: 약 3,000명의 사내 임직원 

## 2. 디렉토리 구조
```
it_frontend 프론트엔드
it_backend  백엔드
```

## 3. 기술 스택 (Tech Stack)
각 디렉토리에 있는 CLAUDE.md 파일을 참조하세요.

## 4. 개발 환경

### 4.1 로컬 서버 URL
| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui/index.html |

### 4.2 서버 시작
```bash
# 백엔드 (it_backend 디렉토리)
./gradlew bootRun

# 프론트엔드 (it_frontend 디렉토리)
npm run dev
```

## 5. AI 하네스 가이드

### 5.1 bkit PDCA
- 현재 진행 피처: **rbac** (design 페이즈)
- 상태 확인: `/pdca status`
- 다음 단계 진행: `/pdca do rbac`
- 새 피처 시작: `/pdca plan {피처명}`

### 5.2 gstack QA 워크플로우
두 서버(`./gradlew bootRun` + `npm run dev`)를 모두 기동한 뒤 `/qa`로 브라우저 기반 테스트를 수행합니다.

- 테스트 대상: http://localhost:3000
- API 서버: http://localhost:8080
- 핵심 테스트 시나리오: 로그인, 프로젝트 조회/생성, 결재 처리

### 5.3 gstack 주요 스킬
| 스킬 | 용도 |
|------|------|
| `/qa` | 화면 기능 테스트 (브라우저 자동화) |
| `/investigate` | 버그·오류 원인 분석 |
| `/review` | 코드 리뷰 (diff 기준) |
| `/ship` | PR 생성 및 배포 |
| `/health` | 코드 품질 점검 |
| `/checkpoint` | 작업 중간 저장 및 복원 |

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health