# 개발 노트 (Development Notes)

## 1. 시스템 개요

IT Portal (IT 정보화 포탈)은 정보화 예산, 사업, 인력을 관리하는 내부 업무 시스템입니다.  

## 2. 개발 방법론

본 프로젝트는 AI Agentic Engineering 기반 개발을 추구하며, 고품질의 통제 가능한 AI Agentic Engineering을 위해 다음의 방식으로 하네스 엔지니어링(Harness Engineering)을 구현합니다. 하네스 엔지니어링은 실제 환경에서 안정적이고 예측 가능하게 업무를 수행하도록 감싸는 실행 인프라를 설계하는 기술입니다.

- [지침] CLAUDE.md 파일은 AI 어시스턴트가 코드를 생성할 때 준수해야 할 지침을 정의합니다.
- [스킬] SKILL.md 파일을 기반으로 동작하며 gstack을 사용합니다.
```
gstack은 Y Combinator의 사장 겸 CEO인 개리 탄이 개발한 방식으로, Claude Code를 가상 엔지니어링 팀으로 만들어 줍니다. 제품을 재구상하는 CEO, 아키텍처를 확정하는 엔지니어링 매니저, AI 오류를 잡아내는 디자이너, 프로덕션 버그를 찾아내는 리뷰어, 실제 브라우저를 열어보는 QA 리더, OWASP + STRIDE 감사를 실행하는 보안 담당자, 그리고 PR을 배포하는 릴리스 엔지니어까지. 23명의 전문가와 8개의 강력한 도구, 모두 슬래시 명령어, 마크다운, 그리고 MIT 라이선스를 사용하는 무료 도구들입니다.
[출처] https://github.com/garrytan/gstack
```
- [문서화] bkit PDCA는 Claude Code 플러그인으로 PDCA 방법론 + CTO 주도 에이전트 팀 기반으로 동작합니다.
```
bkit은 Claude Code 플러그인으로, AI를 활용하여 소프트웨어 개발 방식을 혁신합니다. PDCA(계획-실행-점검-조치) 방법론을 통해 구조화된 개발 워크플로, 자동 문서화, 지능형 코드 지원 기능을 제공합니다.
[출처] https://github.com/popup-studio-ai/bkit-claude-code
```

### 2.1 상세 업무 설계 및 주요 작업 시

`/pdca plan {기능 요구사항}`을 시작으로 계획(plan) > 설계(design) > 실행(do) > 점검/분석(analysis) > 문서 정리(archive) 순으로 진행한다.

- 시작: `/pdca plan {기능 요구사항}`
- 상태 확인: `/pdca status`
- 다음 단계 확인: `/pdca next`

### 2.2 [REVIEW.md] 프로적트 및 문서 정비

 it_backend, it_frontend 디렉토리 전체를 분석하여 불합리한 구조, 비효율적인 코드, 개선이 필요해 보이는 로직을 찾아내어 수정하고 CLAUDE.md(코드 컨벤션), README.md(개발노트), TASK.md(프로젝트 백로그)를 업데이트한다.

- 시작: `REVIEW.md 진행해줘`

### 2.3 [TEST.md] 테스트 코드 정비

 it_backend, it_frontend 디렉토리 전체를 분석하여 테스트 코드를 작성한다.

- 시작: `TEST.md 진행해줘`

### 2.4 [/simplify] 코드정비

Claude Code에서 제공하는 기능으로 코드의 기능은 그대로 보존하면서 명확성·일관성·유지보수성을 개선한다.

- 시작: `/simplify 하위 디렉토리 포함`

### 2.5 [gstack QA 테스트] (브라우저 기반 테스트)

전반적인 브라우저 기반 품질 테스트를 하고자 하는 경우 두 서버(`./gradlew bootRun` + `npm run dev`)를 모두 기동한 뒤 `/gstack qa`을 입력하여 브라우저 기반 테스트를 수행합니다.

- 시작: `/gstack qa`
 
### 2.6 [기타 gstack] 주요 스킬
| 스킬                    | 용도                   |
| --------------------- | -------------------- |
| `/gstack qa`          | 화면 기능 테스트 (브라우저 자동화) |
| `/gstack investigate` | 버그·오류 원인 분석          |
| `/gstack review`      | 코드 리뷰 (diff 기준)      |
| `/gstack ship`        | PR 생성 및 배포           |
| `/gstack health`      | 코드 품질 점검             |
| `/gstack checkpoint`  | 작업 중간 저장 및 복원        |
