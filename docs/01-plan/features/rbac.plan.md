## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | rbac (자격등급 기반 권한관리) |
| 작성일 | 2026-03-25 |
| 단계 | Plan |

### Value Delivered

| 관점 | 내용 |
|------|------|
| Problem | 현재 모든 인증된 사용자가 동일한 접근 권한을 가져 부서/역할 기반 데이터 보호가 불가능함 |
| Solution | TAAABB_CROLEI/TAAABB_CAUTHI 테이블 기반 RBAC를 JWT 클레임에 반영하고 백엔드·프론트 양쪽에서 권한 제어 |
| Function UX Effect | 일반사용자는 본인 소속 부서 데이터만 조회/수정, 기획통할담당자는 부서 전체 관리, 시스템관리자는 전체 관리 + 관리자 메뉴 노출 |
| Core Value | 3,000명 임직원의 데이터 접근을 자격등급에 따라 안전하게 분리하여 컴플라이언스 및 데이터 보안 확보 |

---

# rbac Plan — 자격등급 기반 권한관리 (RBAC)

## 1. 개요

### 1.1 배경 및 목적
현재 IT Portal 시스템은 JWT 인증은 구현되어 있으나 `CustomUserDetailsService`의 authorities가 빈 목록(`Collections.emptyList()`)으로 설정되어 **역할 기반 접근 제어(RBAC)가 미구현** 상태다. 모든 인증 사용자가 동일한 권한을 가져 부서 간 데이터 격리가 불가능하다.

PRD.md 요구사항에 따라 자격등급(`TAAABB_CAUTHI`) 및 역할매핑(`TAAABB_CROLEI`) 테이블을 활용하여 3단계 RBAC를 구현한다.

### 1.2 자격등급 체계

| ATH_ID | 자격등급명 | 조회 범위 | 수정/삭제 범위 | 관리자 메뉴 |
|--------|-----------|-----------|--------------|-----------|
| ITPZZ001 | 일반사용자 | 소속 부서 컨텐츠 | 본인 작성 컨텐츠만 | 미노출 |
| ITPZZ002 | 기획통할담당자 | 소속 부서 컨텐츠 | 소속 부서 컨텐츠 | 미노출 |
| ITPAD001 | 시스템관리자 | 모든 부서 컨텐츠 | 모든 컨텐츠 | 노출 |

### 1.3 관련 테이블

| 테이블명 | 역할 | 주요 컬럼 |
|---------|------|---------|
| TAAABB_CUSERI | 사용자 | ENO(행번), BBR_C(부서코드), TEM_C(팀코드) |
| TAAABB_CORGNI | 조직 | PRLM_OGZ_C_CONE(조직코드), BBR_NM(부점명) |
| TAAABB_CAUTHI | 자격등급 | ATH_ID(권한ID), QLF_GR_NM(자격등급명) |
| TAAABB_CROLEI | 역할관리(사용자↔자격등급) | ATH_ID(권한ID), ENO(사원번호) |

---

## 2. 요구사항

### 2.1 기능 요구사항

#### FR-01. JWT 클레임에 자격등급/부서 정보 포함
- 로그인 시 `TAAABB_CROLEI`에서 사용자의 ATH_ID 조회
- JWT Access Token 클레임에 `athId`, `bbrC`(부서코드) 추가
- `JwtUtil.generateAccessToken(eno, athId, bbrC)` 시그니처 변경

#### FR-02. Spring Security 권한(Authority) 등록
- `CustomUserDetailsService`에서 `TAAABB_CROLEI` 조회하여 `GrantedAuthority` 설정
- Spring Security Role 매핑: `ITPZZ001` → `ROLE_USER`, `ITPZZ002` → `ROLE_DEPT_MANAGER`, `ITPAD001` → `ROLE_ADMIN`

#### FR-03. 백엔드 서비스 레이어 권한 제어
- 조회 API: 현재 사용자의 `bbrC`(부서코드) 기준으로 데이터 필터링
  - `ROLE_USER`, `ROLE_DEPT_MANAGER`: 본인 부서 데이터만 반환
  - `ROLE_ADMIN`: 전체 데이터 반환
- 수정/삭제 API: 권한 검증 후 403 반환
  - `ROLE_USER`: `fstEnrUsid == currentUserEno` 인 경우만 허용
  - `ROLE_DEPT_MANAGER`: `bbrC == currentUserBbrC` 인 경우만 허용
  - `ROLE_ADMIN`: 모든 경우 허용

#### FR-04. SecurityConfig URL 기반 권한 설정
- `/api/admin/**` 경로: `ROLE_ADMIN`만 접근 허용
- 그 외 인증 필요 경로: 모든 인증 사용자 허용 (서비스 레이어에서 세부 제어)

#### FR-05. 프론트엔드 권한 반응형 UI
- `useAuth` composable에 `athId`, `bbrC`, role 헬퍼 함수 추가
- 관리자 메뉴(`AppSidebar.vue`): `ROLE_ADMIN`만 노출
- 수정/삭제 버튼: 권한에 따라 표시 여부 동적 제어
- Pinia auth store에 `athId`, `bbrC` 상태 추가

#### FR-06. 관리자 페이지 라우팅 보호
- `middleware/auth.global.ts` 또는 신규 `middleware/admin.ts`에서 관리자 경로 접근 차단

### 2.2 비기능 요구사항
- JWT 토큰 재발급(`/api/auth/refresh`) 시에도 최신 자격등급 반영
- 자격등급 없는 사용자(TAAABB_CROLEI 미등록): 기본값 `ITPZZ001`(일반사용자) 적용
- 성능: 로그인 시 최대 1회 DB 조회 추가로 지연 최소화

---

## 3. 아키텍처 변경 계획

### 3.1 백엔드 변경 사항

```
[변경] JwtUtil
  - generateAccessToken(eno, athId, bbrC): athId, bbrC 클레임 추가
  - getAthIdFromToken(token): athId 클레임 추출
  - getBbrCFromToken(token): bbrC 클레임 추출

[변경] CustomUserDetailsService
  - CroleIRepository 의존성 추가
  - loadUserByUsername(): authorities에 자격등급 역할 추가

[신규] domain/entity/CauthI.java
  - TAAABB_CAUTHI 엔티티

[신규] domain/entity/CroleI.java
  - TAAABB_CROLEI 엔티티

[신규] repository/CauthIRepository.java
[신규] repository/CroleIRepository.java

[변경] security/JwtAuthenticationFilter.java
  - Authentication 객체에 athId, bbrC 포함 (CustomUserDetails 도입)

[신규] security/CustomUserDetails.java
  - UserDetails 확장: eno, athId, bbrC 포함

[변경] service/AuthService.java
  - login(): CroleIRepository 조회 후 athId, bbrC를 JWT에 포함

[변경] 각 Service (ProjectService, ApplicationService 등)
  - SecurityContextHolder에서 CustomUserDetails 추출
  - 조회/수정/삭제 시 권한 검증 로직 추가

[변경] config/SecurityConfig.java
  - /api/admin/** → hasRole("ADMIN") 설정
```

### 3.2 프론트엔드 변경 사항

```
[변경] types/auth.ts
  - User 타입에 athId, bbrC 추가

[변경] stores/auth.ts
  - state에 athId, bbrC 추가
  - 로그인 응답 처리 시 저장

[변경] composables/useAuth.ts
  - isAdmin(), isDeptManager(), isUser() 헬퍼 추가
  - hasPermission(action, resource) 유틸

[변경] components/AppSidebar.vue
  - 관리자 메뉴 항목: v-if="isAdmin()" 조건 추가

[변경] middleware/auth.global.ts 또는
[신규] middleware/admin.ts
  - /admin/** 경로 접근 시 ROLE_ADMIN 검증

[변경] 각 list/form 페이지
  - 수정/삭제 버튼: v-if 권한 조건 추가
```

---

## 4. 구현 순서

### Phase 1 — 백엔드 기반 구조 (우선)
1. `CauthI`, `CroleI` 엔티티 생성
2. `CauthIRepository`, `CroleIRepository` 생성
3. `CustomUserDetails` 생성 (eno, athId, bbrC, authorities 포함)
4. `JwtUtil` 수정 (클레임 추가/추출 메서드)
5. `CustomUserDetailsService` 수정 (자격등급 로드)
6. `JwtAuthenticationFilter` 수정 (CustomUserDetails 세팅)
7. `AuthService.login()` 수정 (athId, bbrC JWT 포함)
8. `SecurityConfig` 수정 (/api/admin/** 권한 설정)

### Phase 2 — 서비스 레이어 권한 제어
9. `ProjectService` 권한 검증 로직 추가
10. `ApplicationService` 권한 검증 로직 추가
11. 기타 서비스 (BrdocmService, BgdocmService 등) 권한 검증

### Phase 3 — 프론트엔드
12. `types/auth.ts`, `stores/auth.ts` 수정
13. `useAuth.ts` 헬퍼 함수 추가
14. `AppSidebar.vue` 관리자 메뉴 조건 추가
15. 페이지별 수정/삭제 버튼 권한 조건 추가
16. 관리자 라우트 미들웨어

---

## 5. 영향 범위

### 5.1 수정 필요 파일 (백엔드)
- `util/JwtUtil.java`
- `security/JwtAuthenticationFilter.java`
- `service/CustomUserDetailsService.java`
- `service/AuthService.java`
- `config/SecurityConfig.java`
- `service/ProjectService.java`
- `service/ApplicationService.java`
- `service/BrdocmService.java`
- `service/BgdocmService.java`
- `service/CostService.java`
- `dto/AuthDto.java` (LoginResponse에 athId, bbrC 추가)

### 5.2 신규 생성 파일 (백엔드)
- `domain/entity/CauthI.java`
- `domain/entity/CroleI.java`
- `repository/CauthIRepository.java`
- `repository/CroleIRepository.java`
- `security/CustomUserDetails.java`

### 5.3 수정 필요 파일 (프론트엔드)
- `types/auth.ts`
- `stores/auth.ts`
- `composables/useAuth.ts`
- `components/AppSidebar.vue`
- `middleware/auth.global.ts`
- `pages/info/projects/index.vue`, `[id].vue`, `form.vue`
- `pages/info/projects/ordinary/index.vue`, `form.vue`
- `pages/budget/index.vue`, `list.vue`, `approval.vue`

---

## 6. 위험 요소 및 대응

| 위험 | 가능성 | 대응 |
|------|--------|------|
| TAAABB_CROLEI 미등록 사용자 처리 | 중 | 기본값 ITPZZ001 적용 |
| 기존 JWT 토큰 호환성 | 중 | 클레임 없으면 ITPZZ001 fallback |
| 서비스 레이어 누락으로 권한 우회 | 높 | 설계 단계에서 전체 서비스 목록 체크리스트 작성 |
| 프론트엔드 UI 미반영으로 혼선 | 낮 | 백엔드 403 응답 + 프론트 에러 핸들링 병행 |
