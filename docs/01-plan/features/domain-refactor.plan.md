# Plan: 도메인 기반 레이어드 아키텍처 리팩토링

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | domain-refactor |
| 작성일 | 2026-03-26 |
| 대상 | IT Portal System 백엔드 + 프론트엔드 |

### 1.1 Value Delivered (4관점)

| 관점 | 내용 |
|------|------|
| Problem | 모든 클래스가 단일 패키지에 혼재되어 도메인 경계가 불명확하고 순환 참조 위험 및 유지보수 비용이 높음 |
| Solution | 도메인(common/budget/infra) 기반 패키지 분리 + 직관적 네이밍 컨벤션 통일로 도메인 경계 명확화 |
| Function UX Effect | 백엔드 API 경로 유지로 프론트엔드 영향 최소화, TypeScript 타입 동기화로 타입 안전성 향상 |
| Core Value | 기능 확장 시 신규 도메인을 독립적으로 추가 가능한 확장성 확보, 순환 참조 구조적 방지 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 평면 구조에서 도메인 경계 없이 성장한 코드베이스를 정리하여 향후 기능 확장 비용 절감 |
| WHO | IT Portal System 백엔드 개발팀 (Spring Boot 4.0.1 / Java 25) |
| RISK | 100여 개 파일의 패키지·임포트 일괄 변경 → 빌드 오류 또는 누락 가능성 |
| SUCCESS | `./gradlew build` 성공, 기존 테스트 통과, 프론트엔드 API 호출 정상 동작 |
| SCOPE | 백엔드 패키지 재구조화 + 클래스 리네이밍(일부) + 프론트엔드 TypeScript 타입 동기화 |

---

## 1. 배경 및 목적

### 1.1 현재 구조의 문제점

현재 백엔드(`com.kdb.it.*`)는 모든 클래스가 레이어별 단일 패키지에 혼재되어 있음:

```
com.kdb.it/
├── controller/   ← 13개 컨트롤러 혼재
├── service/      ← 14개 서비스 혼재
├── repository/   ← 20개 리포지토리 혼재
├── domain/entity/← 16개 엔티티 혼재
├── dto/          ← 13개 DTO 혼재
├── config/
├── security/
├── exception/
└── util/
```

**문제점:**
- 도메인 간 의존성 방향이 코드에서 식별 불가 (순환 참조 위험)
- 신규 기능 추가 시 어느 도메인에 속하는지 판단 기준 없음
- 클래스명이 DB 접두사 기반(`Ccodem`, `Brdocm`)이어서 역할 파악이 어려운 Service/Controller 존재

### 1.2 목표

1. **도메인별 패키지 분리**: common / budget / infra 3개 최상위 도메인으로 분리
2. **단방향 의존성 강제**: `budget → common`, `infra → common` (역방향 금지)
3. **직관적 네이밍 통일**: Service, Controller, Repository, DTO 클래스명을 도메인/비즈니스 명칭으로 통일
4. **프론트엔드 동기화**: 백엔드 변경사항을 Nuxt 4 프론트엔드에 반영

---

## 2. 목표 패키지 구조

```
com.kdb.it/
├── common/
│   ├── system/          # 인증·로그인 (JWT, Spring Security)
│   ├── iam/             # 사용자·조직·권한·역할
│   ├── approval/        # 신청서·결재
│   ├── code/            # 공통 코드 관리
│   └── util/            # 공통 유틸리티
├── budget/
│   ├── project/         # 정보화사업 (프로젝트·품목·관련문서)
│   └── cost/            # 전산업무비
├── infra/
│   ├── file/            # 파일 관리
│   └── ai/              # AI (Gemini) 연동
├── config/              # 전역 설정 (Spring Security, JPA, Swagger 등)
└── exception/           # 전역 예외 처리
```

---

## 3. 도메인별 클래스 마이그레이션 매핑

### 3.1 common/system (인증·로그인)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| controller/AuthController | common/system | 유지 |
| service/AuthService | common/system | 유지 |
| service/CustomUserDetailsService | common/system | 유지 |
| dto/AuthDto | common/system | 유지 |
| domain/entity/LoginHistory | common/system | 유지 |
| domain/entity/RefreshToken | common/system | 유지 |
| controller/LoginHistoryController | common/system | 유지 |
| service/LoginHistoryService | common/system | 유지 |
| dto/LoginHistoryDto | common/system | 유지 |
| repository/LoginHistoryRepository | common/system | 유지 |
| repository/RefreshTokenRepository | common/system | 유지 |
| security/CustomUserDetails | common/system | 유지 |
| security/JwtAuthenticationFilter | common/system | 유지 |
| util/JwtUtil | common/system | 유지 |

### 3.2 common/iam (사용자·조직·권한·역할)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| controller/UserController | common/iam | 유지 |
| service/UserService | common/iam | 유지 |
| dto/UserDto | common/iam | 유지 |
| domain/entity/CuserI | common/iam | 유지 (DB명 기반) |
| repository/CuserIRepository | common/iam | 유지 |
| repository/CuserIRepositoryCustom | common/iam | 유지 |
| repository/CuserIRepositoryImpl | common/iam | 유지 |
| controller/OrganizationController | common/iam | 유지 |
| service/OrganizationService | common/iam | 유지 |
| dto/OrganizationDto | common/iam | 유지 |
| domain/entity/CorgnI | common/iam | 유지 (DB명 기반) |
| repository/CorgnIRepository | common/iam | 유지 |
| domain/entity/CauthI | common/iam | 유지 (DB명 기반) |
| repository/CauthIRepository | common/iam | 유지 |
| domain/entity/CroleI | common/iam | 유지 (DB명 기반) |
| domain/entity/CroleIId | common/iam | 유지 |
| repository/CroleIRepository | common/iam | 유지 |

### 3.3 common/approval (신청서·결재)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| controller/ApplicationController | common/approval | 유지 |
| service/ApplicationService | common/approval | 유지 |
| dto/ApplicationDto | common/approval | 유지 |
| dto/ApplicationInfoDto | common/approval | 유지 |
| domain/entity/Capplm | common/approval | 유지 (DB명 기반) |
| repository/CapplmRepository | common/approval | 유지 |
| domain/entity/Cappla | common/approval | 유지 (DB명 기반) |
| repository/CapplaRepository | common/approval | 유지 |
| domain/entity/Cdecim | common/approval | 유지 (DB명 기반) |
| domain/entity/CdecimId | common/approval | 유지 |
| repository/CdecimRepository | common/approval | 유지 |

### 3.4 common/code (공통 코드)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| controller/CcodemController | common/code | **CodeController** |
| service/CcodemService | common/code | **CodeService** |
| dto/CcodemDto | common/code | **CodeDto** |
| domain/entity/Ccodem | common/code | 유지 (DB명 기반) |
| repository/CcodemRepository | common/code | **CodeRepository** |
| repository/CcodemRepositoryCustom | common/code | **CodeRepositoryCustom** |
| repository/CcodemRepositoryImpl | common/code | **CodeRepositoryImpl** |

### 3.5 common/util (공통 유틸)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| util/CookieUtil | common/util | 유지 |
| util/HtmlSanitizer | common/util | 유지 |
| config/CustomPasswordEncoder | common/util | 유지 |

### 3.6 budget/project (정보화사업)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| controller/ProjectController | budget/project | 유지 |
| service/ProjectService | budget/project | 유지 |
| dto/ProjectDto | budget/project | 유지 |
| domain/entity/Bprojm | budget/project | 유지 (DB명 기반) |
| domain/entity/BprojmId | budget/project | 유지 |
| repository/ProjectRepository | budget/project | 유지 |
| repository/ProjectRepositoryCustom | budget/project | 유지 |
| repository/ProjectRepositoryImpl | budget/project | 유지 |
| domain/entity/Bitemm | budget/project | 유지 (DB명 기반) |
| domain/entity/BitemmId | budget/project | 유지 |
| repository/BitemmRepository | budget/project | **ProjectItemRepository** |
| controller/BrdocmController | budget/project | **ProjectDocController** |
| service/BrdocmService | budget/project | **ProjectDocService** |
| dto/BrdocmDto | budget/project | **ProjectDocDto** |
| domain/entity/Brdocm | budget/project | 유지 (DB명 기반) |
| repository/BrdocmRepository | budget/project | **ProjectDocRepository** |

### 3.7 budget/cost (전산업무비)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| controller/CostController | budget/cost | 유지 |
| service/CostService | budget/cost | 유지 |
| dto/CostDto | budget/cost | 유지 |
| domain/entity/Bcostm | budget/cost | 유지 (DB명 기반) |
| domain/entity/BcostmId | budget/cost | 유지 |
| repository/BcostmRepository | budget/cost | **CostRepository** |
| repository/BcostmRepositoryCustom | budget/cost | **CostRepositoryCustom** |
| repository/BcostmRepositoryImpl | budget/cost | **CostRepositoryImpl** |
| controller/BgdocmController | budget/cost | **BudgetDocController** |
| service/BgdocmService | budget/cost | **BudgetDocService** |
| dto/BgdocmDto | budget/cost | **BudgetDocDto** |
| domain/entity/Bgdocm | budget/cost | 유지 (DB명 기반) |
| repository/BgdocmRepository | budget/cost | **BudgetDocRepository** |

### 3.8 infra/file (파일 관리)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| controller/CfilemController | infra/file | **FileController** |
| service/CfilemService | infra/file | **FileService** |
| dto/CfilemDto | infra/file | **FileDto** |
| domain/entity/Cfilem | infra/file | 유지 (DB명 기반) |
| repository/CfilemRepository | infra/file | **FileRepository** |

### 3.9 infra/ai (AI 연동)

| 현재 위치 | 이동 후 패키지 | 클래스명 변경 |
|-----------|--------------|-------------|
| controller/GeminiController | infra/ai | 유지 |
| service/GeminiService | infra/ai | 유지 |
| dto/GeminiDto | infra/ai | 유지 |

### 3.10 config / exception (유지)

| 현재 위치 | 이동 후 패키지 | 비고 |
|-----------|--------------|------|
| config/SecurityConfig | config | 유지 |
| config/JacksonConfig | config | 유지 |
| config/JpaAuditConfig | config | 유지 |
| config/QuerydslConfig | config | 유지 |
| config/SwaggerConfig | config | 유지 |
| exception/CustomGeneralException | exception | 유지 |
| exception/GlobalExceptionHandler | exception | 유지 |
| domain/entity/BaseEntity | (공통) | config 또는 common/util |

---

## 4. 네이밍 컨벤션 변경 요약

### 4.1 클래스명 변경 목록

| 현재 클래스명 | 변경 후 클래스명 | 도메인 |
|------------|--------------|--------|
| CcodemController | CodeController | common/code |
| CcodemService | CodeService | common/code |
| CcodemDto | CodeDto | common/code |
| CcodemRepository | CodeRepository | common/code |
| CcodemRepositoryCustom | CodeRepositoryCustom | common/code |
| CcodemRepositoryImpl | CodeRepositoryImpl | common/code |
| BrdocmController | ProjectDocController | budget/project |
| BrdocmService | ProjectDocService | budget/project |
| BrdocmDto | ProjectDocDto | budget/project |
| BrdocmRepository | ProjectDocRepository | budget/project |
| BitemmRepository | ProjectItemRepository | budget/project |
| BgdocmController | BudgetDocController | budget/cost |
| BgdocmService | BudgetDocService | budget/cost |
| BgdocmDto | BudgetDocDto | budget/cost |
| BgdocmRepository | BudgetDocRepository | budget/cost |
| BcostmRepository | CostRepository | budget/cost |
| BcostmRepositoryCustom | CostRepositoryCustom | budget/cost |
| BcostmRepositoryImpl | CostRepositoryImpl | budget/cost |
| CfilemController | FileController | infra/file |
| CfilemService | FileService | infra/file |
| CfilemDto | FileDto | infra/file |
| CfilemRepository | FileRepository | infra/file |

### 4.2 DTO 네이밍 규칙

기존 DTO 내 정적 중첩 클래스의 접미사를 명확히 통일:
- 요청용: `~Request` (예: `CodeSearchRequest`)
- 응답용: `~Response` 또는 `~Info` (예: `CodeListResponse`, `CodeInfo`)
- 기존 DTO 내부 클래스명이 이미 규칙을 따르는 경우 유지

### 4.3 Repository 메서드 표준화

- 조회: `find...`, `findAll...`
- 존재 확인: `exists...`
- 카운트: `count...`
- 삭제: Soft Delete 전용 (`delete()` 메서드 호출, 물리 삭제 금지)

---

## 5. 의존성 규칙

```
infra ──→ common  (O)
budget ──→ common  (O)
common ──→ budget  (X 금지)
common ──→ infra   (X 금지)
budget ──→ infra   (상황에 따라 검토)
```

**서비스 간 직접 호출 제한:**
- Controller에서 여러 Service 조합 허용
- 필요시 Facade 레이어(`budget.project.ProjectFacade` 등)를 별도 생성
- 도메인 Service 간 직접 의존 금지

---

## 6. 구현 순서

### Phase 1: 공통(common) 도메인 분리
1. `common/system` - AuthService, LoginHistory, JWT 관련
2. `common/iam` - User, Organization, Role, Auth 엔티티·서비스
3. `common/approval` - Application, 결재선 관련
4. `common/code` - Code 도메인 (클래스명 변경 포함)
5. `common/util` - 유틸리티 이동

### Phase 2: budget 도메인 분리
1. `budget/project` - Project, Item, ProjectDoc
2. `budget/cost` - Cost, BudgetDoc (클래스명 변경 포함)

### Phase 3: infra 도메인 분리
1. `infra/file` - File (클래스명 변경 포함)
2. `infra/ai` - Gemini AI

### Phase 4: config/exception 정리
- BaseEntity 위치 확정 (common/util 이동)
- config, exception 패키지 유지

### Phase 5: 빌드 검증 및 테스트
- `./gradlew clean build` 성공 확인
- 기존 단위 테스트 통과 확인
- Swagger UI에서 API 엔드포인트 동작 확인

### Phase 6: 프론트엔드 동기화
- `it_frontend/app/` 내 TypeScript 타입 정의 업데이트
- composables, stores 내 API 호출 URL 확인 (경로 변경 없음)
- 응답 DTO 구조 변경이 있는 경우 타입 수정

---

## 7. 리스크 및 완화 방안

| 리스크 | 발생 가능성 | 완화 방안 |
|--------|-----------|---------|
| 임포트 누락으로 빌드 실패 | 높음 | Phase별 빌드 확인, IDE 리팩토링 도구 활용 |
| QueryDSL Q클래스 패키지 불일치 | 중간 | `./gradlew clean build` 후 Q클래스 재생성 확인 |
| Spring Security 빈 참조 깨짐 | 중간 | SecurityConfig 임포트 경로 명시적 확인 |
| 프론트엔드 타입 불일치 | 낮음 | API 응답 필드명 변경 없음 (Entity명 유지) |
| 순환 참조 잔존 | 낮음 | 패키지 구조로 강제 분리, 빌드 시 확인 |

---

## 8. 성공 기준

- [ ] `./gradlew clean build` 성공
- [ ] 기존 테스트 (`ProjectControllerTest`, `AuthControllerTest`, `ProjectServiceTest`) 통과
- [ ] Swagger UI 13개 API 그룹 정상 표시
- [ ] 프론트엔드 개발 서버 정상 구동 및 API 호출 정상
- [ ] 순환 참조 없음 (IntelliJ 또는 ArchUnit으로 확인 권장)
- [ ] `budget → common` 단방향 의존성 유지

---

## 9. 스코프 제외 항목

- API 엔드포인트 경로 변경 (URL은 현행 유지)
- Entity 클래스명 변경 (DB 테이블명 기반 유지)
- 비즈니스 로직 변경
- 신규 기능 추가
- MyBatis 관련 XML 매핑 파일 (존재 시 별도 검토 필요)
