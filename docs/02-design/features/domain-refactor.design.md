# Design: 도메인 기반 레이어드 아키텍처 리팩토링

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 평면 구조에서 도메인 경계 없이 성장한 코드베이스를 정리하여 향후 기능 확장 비용 절감 |
| WHO | IT Portal System 백엔드 개발팀 (Spring Boot 4.0.1 / Java 25) |
| RISK | 100여 개 파일의 패키지·임포트 일괄 변경 → 빌드 오류 또는 누락 가능성 |
| SUCCESS | `./gradlew build` 성공, 기존 테스트 통과, 프론트엔드 API 호출 정상 동작 |
| SCOPE | 백엔드 패키지 재구조화 + 클래스 리네이밍(24개) + 프론트엔드 TypeScript 타입 동기화 |

---

## 1. 선택된 아키텍처: Option A (레이어 서브패키지 보존)

각 도메인 패키지 내에 `controller/`, `service/`, `entity/`, `repository/`, `dto/` 서브패키지를 유지합니다.

**선택 이유**: 기존 레이어드 패턴에 익숙한 팀에 적응 비용이 낮고, 레이어 단위 파일 탐색 방식 유지 가능.

**설계 변경 (v2)**: `Bgdocm(GuideDoc)`과 `Brdocm(ServiceRequestDoc)`을 각각의 업무 도메인에서 분리하여
`budget/document/` 독립 서브도메인으로 통합. 문서 관리 로직을 단일 책임 도메인으로 집중.

---

## 2. 최종 패키지 구조

```
src/main/java/com/kdb/it/
├── common/
│   ├── system/                  # 인증·로그인 (JWT, Spring Security)
│   │   ├── controller/
│   │   │   ├── AuthController.java
│   │   │   └── LoginHistoryController.java
│   │   ├── service/
│   │   │   ├── AuthService.java
│   │   │   ├── LoginHistoryService.java
│   │   │   └── CustomUserDetailsService.java
│   │   ├── entity/
│   │   │   ├── LoginHistory.java
│   │   │   └── RefreshToken.java
│   │   ├── repository/
│   │   │   ├── LoginHistoryRepository.java
│   │   │   └── RefreshTokenRepository.java
│   │   ├── dto/
│   │   │   ├── AuthDto.java
│   │   │   └── LoginHistoryDto.java
│   │   └── security/            # JWT·Security 전용 서브패키지
│   │       ├── CustomUserDetails.java
│   │       ├── JwtAuthenticationFilter.java
│   │       └── JwtUtil.java
│   ├── iam/                     # 사용자·조직·권한·역할
│   │   ├── controller/
│   │   │   ├── UserController.java
│   │   │   └── OrganizationController.java
│   │   ├── service/
│   │   │   ├── UserService.java
│   │   │   └── OrganizationService.java
│   │   ├── entity/
│   │   │   ├── CuserI.java
│   │   │   ├── CorgnI.java
│   │   │   ├── CauthI.java
│   │   │   ├── CroleI.java
│   │   │   └── CroleIId.java
│   │   ├── repository/
│   │   │   ├── UserRepository.java              ← CuserIRepository (리네이밍)
│   │   │   ├── UserRepositoryCustom.java        ← CuserIRepositoryCustom (리네이밍)
│   │   │   ├── UserRepositoryImpl.java          ← CuserIRepositoryImpl (리네이밍)
│   │   │   ├── OrganizationRepository.java      ← CorgnIRepository (리네이밍)
│   │   │   ├── AuthRepository.java              ← CauthIRepository (리네이밍)
│   │   │   └── RoleRepository.java              ← CroleIRepository (리네이밍)
│   │   └── dto/
│   │       ├── UserDto.java
│   │       └── OrganizationDto.java
│   ├── approval/                # 신청서·결재
│   │   ├── controller/
│   │   │   └── ApplicationController.java
│   │   ├── service/
│   │   │   └── ApplicationService.java
│   │   ├── entity/
│   │   │   ├── Capplm.java
│   │   │   ├── Cappla.java
│   │   │   ├── Cdecim.java
│   │   │   └── CdecimId.java
│   │   ├── repository/
│   │   │   ├── ApplicationRepository.java           ← CapplmRepository (리네이밍)
│   │   │   ├── ApplicationMapRepository.java        ← CapplaRepository (리네이밍)
│   │   │   └── ApproverRepository.java              ← CdecimRepository (리네이밍)
│   │   └── dto/
│   │       ├── ApplicationDto.java
│   │       └── ApplicationInfoDto.java
│   ├── code/                    # 공통 코드 관리
│   │   ├── controller/
│   │   │   └── CodeController.java          ← CcodemController (리네이밍)
│   │   ├── service/
│   │   │   └── CodeService.java             ← CcodemService (리네이밍)
│   │   ├── entity/
│   │   │   └── Ccodem.java
│   │   ├── repository/
│   │   │   ├── CodeRepository.java          ← CcodemRepository (리네이밍)
│   │   │   ├── CodeRepositoryCustom.java    ← CcodemRepositoryCustom (리네이밍)
│   │   │   └── CodeRepositoryImpl.java      ← CcodemRepositoryImpl (리네이밍)
│   │   └── dto/
│   │       └── CodeDto.java                 ← CcodemDto (리네이밍)
│   └── util/                    # 공통 유틸리티
│       ├── CookieUtil.java
│       ├── HtmlSanitizer.java
│       └── CustomPasswordEncoder.java       ← config/ 에서 이동
├── budget/
│   ├── project/                 # 정보화사업 (문서 제외)
│   │   ├── controller/
│   │   │   └── ProjectController.java
│   │   ├── service/
│   │   │   └── ProjectService.java
│   │   ├── entity/
│   │   │   ├── Bprojm.java
│   │   │   ├── BprojmId.java
│   │   │   ├── Bitemm.java
│   │   │   └── BitemmId.java
│   │   ├── repository/
│   │   │   ├── ProjectRepository.java
│   │   │   ├── ProjectRepositoryCustom.java
│   │   │   ├── ProjectRepositoryImpl.java
│   │   │   └── ProjectItemRepository.java   ← BitemmRepository (리네이밍)
│   │   └── dto/
│   │       └── ProjectDto.java
│   ├── cost/                    # 전산업무비 (문서 제외)
│   │   ├── controller/
│   │   │   └── CostController.java
│   │   ├── service/
│   │   │   └── CostService.java
│   │   ├── entity/
│   │   │   ├── Bcostm.java
│   │   │   └── BcostmId.java
│   │   ├── repository/
│   │   │   ├── CostRepository.java          ← BcostmRepository (리네이밍)
│   │   │   ├── CostRepositoryCustom.java    ← BcostmRepositoryCustom (리네이밍)
│   │   │   └── CostRepositoryImpl.java      ← BcostmRepositoryImpl (리네이밍)
│   │   └── dto/
│   │       └── CostDto.java
│   └── document/                # ★ 예산 문서 통합 (신규 서브도메인)
│       ├── controller/
│       │   ├── ServiceRequestDocController.java   ← BrdocmController (리네이밍)
│       │   └── GuideDocController.java            ← BgdocmController (리네이밍)
│       ├── service/
│       │   ├── ServiceRequestDocService.java      ← BrdocmService (리네이밍)
│       │   └── GuideDocService.java               ← BgdocmService (리네이밍)
│       ├── entity/
│       │   ├── Brdocm.java                        (Entity명 유지 - DB명 기반)
│       │   └── Bgdocm.java                        (Entity명 유지 - DB명 기반)
│       ├── repository/
│       │   ├── ServiceRequestDocRepository.java   ← BrdocmRepository (리네이밍)
│       │   └── GuideDocRepository.java            ← BgdocmRepository (리네이밍)
│       └── dto/
│           ├── ServiceRequestDocDto.java          ← BrdocmDto (리네이밍)
│           └── GuideDocDto.java                   ← BgdocmDto (리네이밍)
├── infra/
│   ├── file/                    # 파일 관리
│   │   ├── controller/
│   │   │   └── FileController.java          ← CfilemController (리네이밍)
│   │   ├── service/
│   │   │   └── FileService.java             ← CfilemService (리네이밍)
│   │   ├── entity/
│   │   │   └── Cfilem.java
│   │   ├── repository/
│   │   │   └── FileRepository.java          ← CfilemRepository (리네이밍)
│   │   └── dto/
│   │       └── FileDto.java                 ← CfilemDto (리네이밍)
│   └── ai/                      # AI (Gemini) 연동
│       ├── controller/
│       │   └── GeminiController.java
│       ├── service/
│       │   └── GeminiService.java
│       └── dto/
│           └── GeminiDto.java
├── domain/                      # 공유 Entity 베이스
│   └── entity/
│       └── BaseEntity.java      ← 현행 위치 유지 (모든 도메인이 참조)
├── config/                      # 전역 설정 (유지)
│   ├── SecurityConfig.java
│   ├── JacksonConfig.java
│   ├── JpaAuditConfig.java
│   ├── QuerydslConfig.java
│   └── SwaggerConfig.java
└── exception/                   # 전역 예외 처리 (유지)
    ├── CustomGeneralException.java
    └── GlobalExceptionHandler.java
```

> **BaseEntity 위치**: `domain/entity/` 현행 유지. 모든 도메인 엔티티가 상속하므로 특정 도메인에 귀속시키지 않음.

---

## 3. 전체 파일 마이그레이션 테이블

### 3.1 common/system

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/AuthController` | `common/system/controller/AuthController` | 없음 |
| `controller/LoginHistoryController` | `common/system/controller/LoginHistoryController` | 없음 |
| `service/AuthService` | `common/system/service/AuthService` | 없음 |
| `service/LoginHistoryService` | `common/system/service/LoginHistoryService` | 없음 |
| `service/CustomUserDetailsService` | `common/system/service/CustomUserDetailsService` | 없음 |
| `domain/entity/LoginHistory` | `common/system/entity/LoginHistory` | 없음 |
| `domain/entity/RefreshToken` | `common/system/entity/RefreshToken` | 없음 |
| `repository/LoginHistoryRepository` | `common/system/repository/LoginHistoryRepository` | 없음 |
| `repository/RefreshTokenRepository` | `common/system/repository/RefreshTokenRepository` | 없음 |
| `dto/AuthDto` | `common/system/dto/AuthDto` | 없음 |
| `dto/LoginHistoryDto` | `common/system/dto/LoginHistoryDto` | 없음 |
| `security/CustomUserDetails` | `common/system/security/CustomUserDetails` | 없음 |
| `security/JwtAuthenticationFilter` | `common/system/security/JwtAuthenticationFilter` | 없음 |
| `util/JwtUtil` | `common/system/security/JwtUtil` | 없음 |

### 3.2 common/iam ★ 리네이밍 포함

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/UserController` | `common/iam/controller/UserController` | 없음 |
| `controller/OrganizationController` | `common/iam/controller/OrganizationController` | 없음 |
| `service/UserService` | `common/iam/service/UserService` | 없음 |
| `service/OrganizationService` | `common/iam/service/OrganizationService` | 없음 |
| `domain/entity/CuserI` | `common/iam/entity/CuserI` | 없음 |
| `domain/entity/CorgnI` | `common/iam/entity/CorgnI` | 없음 |
| `domain/entity/CauthI` | `common/iam/entity/CauthI` | 없음 |
| `domain/entity/CroleI` | `common/iam/entity/CroleI` | 없음 |
| `domain/entity/CroleIId` | `common/iam/entity/CroleIId` | 없음 |
| `repository/CuserIRepository` | `common/iam/repository/UserRepository` | **CuserIRepository → UserRepository** |
| `repository/CuserIRepositoryCustom` | `common/iam/repository/UserRepositoryCustom` | **CuserIRepositoryCustom → UserRepositoryCustom** |
| `repository/CuserIRepositoryImpl` | `common/iam/repository/UserRepositoryImpl` | **CuserIRepositoryImpl → UserRepositoryImpl** |
| `repository/CorgnIRepository` | `common/iam/repository/OrganizationRepository` | **CorgnIRepository → OrganizationRepository** |
| `repository/CauthIRepository` | `common/iam/repository/AuthRepository` | **CauthIRepository → AuthRepository** |
| `repository/CroleIRepository` | `common/iam/repository/RoleRepository` | **CroleIRepository → RoleRepository** |
| `dto/UserDto` | `common/iam/dto/UserDto` | 없음 |
| `dto/OrganizationDto` | `common/iam/dto/OrganizationDto` | 없음 |

### 3.3 common/approval ★ 리네이밍 포함

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/ApplicationController` | `common/approval/controller/ApplicationController` | 없음 |
| `service/ApplicationService` | `common/approval/service/ApplicationService` | 없음 |
| `domain/entity/Capplm` | `common/approval/entity/Capplm` | 없음 |
| `domain/entity/Cappla` | `common/approval/entity/Cappla` | 없음 |
| `domain/entity/Cdecim` | `common/approval/entity/Cdecim` | 없음 |
| `domain/entity/CdecimId` | `common/approval/entity/CdecimId` | 없음 |
| `repository/CapplmRepository` | `common/approval/repository/ApplicationRepository` | **CapplmRepository → ApplicationRepository** |
| `repository/CapplaRepository` | `common/approval/repository/ApplicationMapRepository` | **CapplaRepository → ApplicationMapRepository** |
| `repository/CdecimRepository` | `common/approval/repository/ApproverRepository` | **CdecimRepository → ApproverRepository** |
| `dto/ApplicationDto` | `common/approval/dto/ApplicationDto` | 없음 |
| `dto/ApplicationInfoDto` | `common/approval/dto/ApplicationInfoDto` | 없음 |

### 3.4 common/code ★ 리네이밍 포함

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/CcodemController` | `common/code/controller/CodeController` | **CcodemController → CodeController** |
| `service/CcodemService` | `common/code/service/CodeService` | **CcodemService → CodeService** |
| `domain/entity/Ccodem` | `common/code/entity/Ccodem` | 없음 |
| `repository/CcodemRepository` | `common/code/repository/CodeRepository` | **CcodemRepository → CodeRepository** |
| `repository/CcodemRepositoryCustom` | `common/code/repository/CodeRepositoryCustom` | **CcodemRepositoryCustom → CodeRepositoryCustom** |
| `repository/CcodemRepositoryImpl` | `common/code/repository/CodeRepositoryImpl` | **CcodemRepositoryImpl → CodeRepositoryImpl** |
| `dto/CcodemDto` | `common/code/dto/CodeDto` | **CcodemDto → CodeDto** |

### 3.5 common/util

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `util/CookieUtil` | `common/util/CookieUtil` | 없음 |
| `util/HtmlSanitizer` | `common/util/HtmlSanitizer` | 없음 |
| `config/CustomPasswordEncoder` | `common/util/CustomPasswordEncoder` | 없음 |

### 3.6 budget/project ★ 리네이밍 포함 (문서 클래스 제외)

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/ProjectController` | `budget/project/controller/ProjectController` | 없음 |
| `service/ProjectService` | `budget/project/service/ProjectService` | 없음 |
| `domain/entity/Bprojm` | `budget/project/entity/Bprojm` | 없음 |
| `domain/entity/BprojmId` | `budget/project/entity/BprojmId` | 없음 |
| `domain/entity/Bitemm` | `budget/project/entity/Bitemm` | 없음 |
| `domain/entity/BitemmId` | `budget/project/entity/BitemmId` | 없음 |
| `repository/ProjectRepository` | `budget/project/repository/ProjectRepository` | 없음 |
| `repository/ProjectRepositoryCustom` | `budget/project/repository/ProjectRepositoryCustom` | 없음 |
| `repository/ProjectRepositoryImpl` | `budget/project/repository/ProjectRepositoryImpl` | 없음 |
| `repository/BitemmRepository` | `budget/project/repository/ProjectItemRepository` | **BitemmRepository → ProjectItemRepository** |
| `dto/ProjectDto` | `budget/project/dto/ProjectDto` | 없음 |

### 3.7 budget/cost ★ 리네이밍 포함 (문서 클래스 제외)

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/CostController` | `budget/cost/controller/CostController` | 없음 |
| `service/CostService` | `budget/cost/service/CostService` | 없음 |
| `domain/entity/Bcostm` | `budget/cost/entity/Bcostm` | 없음 |
| `domain/entity/BcostmId` | `budget/cost/entity/BcostmId` | 없음 |
| `repository/BcostmRepository` | `budget/cost/repository/CostRepository` | **BcostmRepository → CostRepository** |
| `repository/BcostmRepositoryCustom` | `budget/cost/repository/CostRepositoryCustom` | **BcostmRepositoryCustom → CostRepositoryCustom** |
| `repository/BcostmRepositoryImpl` | `budget/cost/repository/CostRepositoryImpl` | **BcostmRepositoryImpl → CostRepositoryImpl** |
| `dto/CostDto` | `budget/cost/dto/CostDto` | 없음 |

### 3.8 budget/document ★ 신규 서브도메인 + 리네이밍

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/BrdocmController` | `budget/document/controller/ServiceRequestDocController` | **BrdocmController → ServiceRequestDocController** |
| `controller/BgdocmController` | `budget/document/controller/GuideDocController` | **BgdocmController → GuideDocController** |
| `service/BrdocmService` | `budget/document/service/ServiceRequestDocService` | **BrdocmService → ServiceRequestDocService** |
| `service/BgdocmService` | `budget/document/service/GuideDocService` | **BgdocmService → GuideDocService** |
| `domain/entity/Brdocm` | `budget/document/entity/Brdocm` | 없음 (Entity명 유지) |
| `domain/entity/Bgdocm` | `budget/document/entity/Bgdocm` | 없음 (Entity명 유지) |
| `repository/BrdocmRepository` | `budget/document/repository/ServiceRequestDocRepository` | **BrdocmRepository → ServiceRequestDocRepository** |
| `repository/BgdocmRepository` | `budget/document/repository/GuideDocRepository` | **BgdocmRepository → GuideDocRepository** |
| `dto/BrdocmDto` | `budget/document/dto/ServiceRequestDocDto` | **BrdocmDto → ServiceRequestDocDto** |
| `dto/BgdocmDto` | `budget/document/dto/GuideDocDto` | **BgdocmDto → GuideDocDto** |

> **설계 근거**: `Brdocm`(업무 의뢰 문서/서비스 요청서)과 `Bgdocm`(지침·가이드 문서)은
> 특정 업무 프로세스(project/cost)에 종속되지 않는 예산 관련 문서 유형입니다.
> `budget/document/`로 통합하면 문서 관리 기능 추가·변경 시 단일 도메인에서 처리 가능합니다.

### 3.9 infra/file ★ 리네이밍 포함

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/CfilemController` | `infra/file/controller/FileController` | **CfilemController → FileController** |
| `service/CfilemService` | `infra/file/service/FileService` | **CfilemService → FileService** |
| `domain/entity/Cfilem` | `infra/file/entity/Cfilem` | 없음 |
| `repository/CfilemRepository` | `infra/file/repository/FileRepository` | **CfilemRepository → FileRepository** |
| `dto/CfilemDto` | `infra/file/dto/FileDto` | **CfilemDto → FileDto** |

### 3.10 infra/ai

| 현재 경로 | 이동 후 경로 | 클래스명 변경 |
|-----------|------------|-------------|
| `controller/GeminiController` | `infra/ai/controller/GeminiController` | 없음 |
| `service/GeminiService` | `infra/ai/service/GeminiService` | 없음 |
| `dto/GeminiDto` | `infra/ai/dto/GeminiDto` | 없음 |

### 3.11 config / exception / domain (현행 유지)

| 현재 경로 | 비고 |
|-----------|------|
| `config/SecurityConfig` | 유지 (임포트 경로만 업데이트) |
| `config/JacksonConfig` | 유지 |
| `config/JpaAuditConfig` | 유지 |
| `config/QuerydslConfig` | 유지 |
| `config/SwaggerConfig` | 유지 |
| `exception/CustomGeneralException` | 유지 |
| `exception/GlobalExceptionHandler` | 유지 |
| `domain/entity/BaseEntity` | 유지 (모든 도메인 엔티티의 상위 클래스) |

---

## 4. 클래스명 변경 전체 목록 (33개)

| 변경 전 | 변경 후 | 도메인 |
|---------|---------|--------|
| ***CuserIRepository*** | ***UserRepository*** | ***common/iam*** |
| ***CuserIRepositoryCustom*** | ***UserRepositoryCustom*** | ***common/iam*** |
| ***CuserIRepositoryImpl*** | ***UserRepositoryImpl*** | ***common/iam*** |
| ***CorgnIRepository*** | ***OrganizationRepository*** | ***common/iam*** |
| ***CauthIRepository*** | ***AuthRepository*** | ***common/iam*** |
| ***CroleIRepository*** | ***RoleRepository*** | ***common/iam*** |
| ***CapplmRepository*** | ***ApplicationRepository*** | ***common/approval*** |
| ***CapplaRepository*** | ***ApplicationMapRepository*** | ***common/approval*** |
| ***CdecimRepository*** | ***ApproverRepository*** | ***common/approval*** |
| CcodemController | CodeController | common/code |
| CcodemService | CodeService | common/code |
| CcodemDto | CodeDto | common/code |
| CcodemRepository | CodeRepository | common/code |
| CcodemRepositoryCustom | CodeRepositoryCustom | common/code |
| CcodemRepositoryImpl | CodeRepositoryImpl | common/code |
| BitemmRepository | ProjectItemRepository | budget/project |
| BcostmRepository | CostRepository | budget/cost |
| BcostmRepositoryCustom | CostRepositoryCustom | budget/cost |
| BcostmRepositoryImpl | CostRepositoryImpl | budget/cost |
| **BrdocmController** | **ServiceRequestDocController** | **budget/document** |
| **BrdocmService** | **ServiceRequestDocService** | **budget/document** |
| **BrdocmDto** | **ServiceRequestDocDto** | **budget/document** |
| **BrdocmRepository** | **ServiceRequestDocRepository** | **budget/document** |
| **BgdocmController** | **GuideDocController** | **budget/document** |
| **BgdocmService** | **GuideDocService** | **budget/document** |
| **BgdocmDto** | **GuideDocDto** | **budget/document** |
| **BgdocmRepository** | **GuideDocRepository** | **budget/document** |
| CfilemController | FileController | infra/file |
| CfilemService | FileService | infra/file |
| CfilemDto | FileDto | infra/file |
| CfilemRepository | FileRepository | infra/file |

> ***이탤릭+굵게***: v3 변경 (iam/approval repository 네이밍 통일)
> **굵게**: v2 변경 (budget/document 통합)
> 일반: v1 초기 설계

---

## 5. 의존성 설계

### 5.1 도메인 간 의존성 방향

```
┌──────────────┐    ┌──────────────┐
│    budget    │───▶│    common    │
└──────────────┘    └──────────────┘
                           ▲
┌──────────────┐           │
│    infra     │───────────┘
└──────────────┘

budget 하위 도메인 간 의존성:
budget/document ──▶ budget/project  (문서가 프로젝트 참조 가능)
budget/document ──▶ budget/cost     (문서가 전산비 참조 가능)
budget/project  ──▶ budget/document (X 금지: 역방향)
budget/cost     ──▶ budget/document (X 금지: 역방향)
```

### 5.2 서비스 간 직접 호출 규칙

```java
// ✅ 허용: Controller에서 여러 Service 조합
@RestController
public class ProjectController {
    private final ProjectService projectService;
    private final ApplicationService applicationService;
    private final ServiceRequestDocService serviceRequestDocService; // document 참조 허용
}

// ❌ 금지: Service에서 다른 도메인 Service 직접 주입
@Service
public class ProjectService {
    // private final ServiceRequestDocService docService; // 금지
}
```

---

## 6. QueryDSL Q클래스 대응

Entity 클래스명은 변경하지 않으므로 Q클래스명은 동일하게 유지됩니다.
패키지 경로가 변경되므로 `./gradlew clean build` 실행 후 Q클래스가 새 경로로 재생성됩니다.

```
// Brdocm → budget/document/entity/Brdocm (클래스명 유지)
// Q클래스: QBrdocm (변경 없음, 패키지 경로만 변경)

// Bgdocm → budget/document/entity/Bgdocm (클래스명 유지)
// Q클래스: QBgdocm (변경 없음, 패키지 경로만 변경)
```

---

## 7. SecurityConfig 주의사항

```java
// config/SecurityConfig.java - import 경로 업데이트 필요
import com.kdb.it.common.system.security.JwtAuthenticationFilter; // 변경
import com.kdb.it.common.system.service.CustomUserDetailsService;  // 변경
import com.kdb.it.common.util.CustomPasswordEncoder;               // 변경
```

---

## 8. 프론트엔드 동기화 설계

### 8.1 API 경로 영향 없음
백엔드 패키지·클래스명 변경은 Spring MVC의 `@RequestMapping` 경로와 무관합니다.

### 8.2 TypeScript 타입 확인 범위

```
it_frontend/app/
├── types/           ← API 응답 타입 정의 확인 (BrdocmDto → ServiceRequestDocDto 등)
├── composables/     ← API 호출 URL 확인 (경로 변경 없음)
└── stores/          ← 상태 관리 타입 확인
```

---

## 9. 빌드 전략

```
Phase 1 완료 → ./gradlew build  (common 검증)
Phase 2 완료 → ./gradlew build  (budget 검증)
Phase 3 완료 → ./gradlew build  (infra 검증)
Phase 4 완료 → ./gradlew clean build  (Q클래스 포함 전체 빌드)
```

---

## 10. 구현 가이드 (Implementation Guide)

### 10.1 모듈별 구현 순서

| 모듈 | 작업 내용 | 파일 수 | 예상 복잡도 |
|------|---------|---------|-----------|
| Module-1 | common/system 이동 | 14개 | 중 (Security 빈 참조) |
| Module-2 | common/iam 이동 | 17개 | 중 |
| Module-3 | common/approval 이동 | 11개 | 낮음 |
| Module-4 | common/code 이동+리네이밍 | 7개 | 중 |
| Module-5 | common/util 이동 | 3개 | 낮음 |
| Module-6 | budget/project 이동+리네이밍 | 11개 | 중 |
| Module-7 | budget/cost 이동+리네이밍 | 8개 | 중 |
| Module-8 | **budget/document 이동+리네이밍** | **10개** | **중** |
| Module-9 | infra/file + infra/ai 이동+리네이밍 | 8개 | 중 |
| Module-10 | 빌드 검증 + 테스트 파일 업데이트 | 5개 | 낮음 |
| Module-11 | 프론트엔드 타입 동기화 | 확인 필요 | 낮음 |

### 10.2 이동 절차 (각 모듈 공통)

1. 새 패키지 디렉토리에 파일 생성
2. `package` 선언 업데이트
3. 리네이밍 대상이면 클래스명 + 파일명 변경
4. 해당 클래스를 참조하는 파일의 `import` 업데이트
5. 생성자 주입 타입명 업데이트
6. 기존 파일 삭제

### 10.3 Session Guide

| 세션 | 모듈 | 설명 |
|------|------|------|
| Session 1 | Module-1 ~ Module-5 | common 도메인 전체 (~52개 파일) |
| Session 2 | Module-6 ~ Module-8 | budget 도메인 전체 (~29개 파일, document 포함) |
| Session 3 | Module-9 ~ Module-11 | infra + 검증 + 프론트엔드 (~16개 파일 + 프론트) |

> `/pdca do domain-refactor --scope module-1` 또는 `--scope module-6,module-7,module-8` 형식으로 세션별 범위 지정
