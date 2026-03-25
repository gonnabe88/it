# rbac Design — 자격등급 기반 권한관리 (RBAC) 상세 설계

> Plan 참조: `docs/01-plan/features/rbac.plan.md`
> v2: 다중 자격등급 지원 반영 (한 사용자가 여러 자격등급 보유 가능)

---

## 1. 아키텍처 개요

### 1.1 다중 자격등급 설계 원칙

`TAAABB_CROLEI`는 `ATH_ID + ENO` 복합키 구조로, **한 사용자(ENO)가 여러 ATH_ID 행을 가질 수 있다**.

```
예시: ENO=12345678 사용자
  TAAABB_CROLEI 행 1: ATH_ID=ITPZZ001 (일반사용자)
  TAAABB_CROLEI 행 2: ATH_ID=ITPZZ002 (기획통할담당자)
```

**권한 적용 방식**: 모든 자격등급을 Spring Security `authorities`에 등록하고, 가장 높은 권한으로 접근 범위를 결정한다 (Union 방식).

**권한 우선순위** (높은 순):
```
ITPAD001 (ROLE_ADMIN) > ITPZZ002 (ROLE_DEPT_MANAGER) > ITPZZ001 (ROLE_USER)
```
→ `isAdmin()`: athIds에 ITPAD001 포함 여부
→ `isDeptManager()`: athIds에 ITPZZ002 **또는** ITPAD001 포함 여부 (Admin은 모든 권한 포함)

### 1.2 인증/권한 흐름

```
[로그인 요청]
  POST /api/auth/login (eno, password)
    └→ AuthService.login()
         ├→ CuserIRepository.findByEno(eno)               // 사용자 조회
         ├→ CroleIRepository.findAllByEnoAndUseYnAndDelYn  // 모든 자격등급 조회 (List)
         │    └→ 없으면 ["ITPZZ001"] 기본값 적용
         └→ JwtUtil.generateAccessToken(eno, athIds, bbrC) // JWT에 자격등급 배열 포함
              └→ 응답: athIds, bbrC, eno, empNm (쿠키: accessToken)

[API 요청]
  HTTP 요청 → JwtAuthenticationFilter
    ├→ JWT 검증 (JwtUtil.validateToken)
    ├→ JWT 클레임에서 eno, athIds(List), bbrC 추출 (DB 재조회 없음 - 성능 최적화)
    ├→ CustomUserDetails 생성 (eno, athIds, bbrC, authorities - 모든 역할 등록)
    └→ SecurityContextHolder 설정

[서비스 레이어]
  Service.method()
    └→ SecurityContextHolder에서 CustomUserDetails 추출
         ├→ isAdmin()       → ROLE_ADMIN 포함 시 전체 데이터 접근
         ├→ isDeptManager() → ROLE_DEPT_MANAGER 또는 ROLE_ADMIN 포함 시 부서 관리
         └→ isUser()        → 기본 (위 두 조건 모두 미포함 시)
```

### 1.3 설계 원칙
- **JWT 클레임 배열**: `athIds`를 JSON 배열로 저장 (JJWT는 List 클레임 지원)
- **모든 역할 등록**: authorities에 사용자의 모든 자격등급에 대응하는 Role 등록
- **권한 포함 관계**: `isAdmin()` → 관리자 권한만, `isDeptManager()` → Admin 포함

---

## 2. 백엔드 상세 설계

### 2.1 신규 엔티티

#### 2.1.1 `CauthI.java` — 자격등급 (TAAABB_CAUTHI)

```java
package com.kdb.it.domain.entity;

@Entity
@Table(name = "TAAABB_CAUTHI")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class CauthI extends BaseEntity {

    @Id
    @Column(name = "ATH_ID", nullable = false, length = 32)
    private String athId;          // 권한ID (예: ITPZZ001)

    @Column(name = "QLF_GR_NM", length = 200)
    private String qlfGrNm;        // 자격등급명 (예: 일반사용자)

    @Column(name = "QLF_GR_MAT", length = 600)
    private String qlfGrMat;       // 자격등급사항(내용)

    @Column(name = "USE_YN", length = 1, columnDefinition = "CHAR(1) DEFAULT 'Y'")
    private String useYn;          // 사용여부

    // BaseEntity: DEL_YN, GUID, FST_ENR_*, LST_CHG_* 제공
}
```

#### 2.1.2 `CroleIId.java` — 역할관리 복합키

```java
package com.kdb.it.domain.entity;

@Embeddable
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class CroleIId implements Serializable {

    @Column(name = "ATH_ID", length = 32)
    private String athId;          // 권한ID

    @Column(name = "ENO", length = 32)
    private String eno;            // 사원번호
}
```

#### 2.1.3 `CroleI.java` — 역할관리 (TAAABB_CROLEI)

```java
package com.kdb.it.domain.entity;

@Entity
@Table(name = "TAAABB_CROLEI")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class CroleI extends BaseEntity {

    @EmbeddedId
    private CroleIId id;           // 복합키: ATH_ID + ENO (1사용자 N자격등급 가능)

    @Column(name = "USE_YN", length = 1, columnDefinition = "CHAR(1) DEFAULT 'Y'")
    private String useYn;          // 사용여부

    // 편의 메서드
    public String getAthId() { return id.getAthId(); }
    public String getEno()   { return id.getEno(); }

    // BaseEntity: DEL_YN, GUID, FST_ENR_*, LST_CHG_* 제공
}
```

### 2.2 신규 Repository

#### 2.2.1 `CauthIRepository.java`

```java
package com.kdb.it.repository;

public interface CauthIRepository extends JpaRepository<CauthI, String> {
    // 기본 CRUD만 사용
}
```

#### 2.2.2 `CroleIRepository.java`

```java
package com.kdb.it.repository;

public interface CroleIRepository extends JpaRepository<CroleI, CroleIId> {

    /**
     * 사번으로 유효한 자격등급 전체 조회 (다중 자격등급 지원)
     * USE_YN='Y', DEL_YN='N' 인 활성 역할을 모두 반환
     *
     * @param eno   사원번호
     * @param useYn 사용여부 ('Y')
     * @param delYn 삭제여부 ('N')
     * @return 해당 사용자의 모든 활성 자격등급 목록 (없으면 빈 리스트)
     */
    List<CroleI> findAllByIdEnoAndUseYnAndDelYn(String eno, String useYn, String delYn);
}
```

### 2.3 `CustomUserDetails.java` — UserDetails 확장 (다중 자격등급)

```java
package com.kdb.it.security;

/**
 * Spring Security UserDetails 확장 구현체
 *
 * JWT 클레임에서 추출한 eno, athIds(복수), bbrC를 담아 SecurityContext에 저장합니다.
 * 한 사용자가 여러 자격등급을 가질 수 있으므로 athIds는 List<String>으로 관리합니다.
 * 모든 자격등급에 대응하는 GrantedAuthority를 등록하여 최상위 권한으로 접근을 허용합니다.
 */
@Getter
public class CustomUserDetails implements UserDetails {

    // 자격등급 ID 상수
    public static final String ATH_ADMIN       = "ITPAD001";
    public static final String ATH_DEPT_MGR    = "ITPZZ002";
    public static final String ATH_USER        = "ITPZZ001";

    // Spring Security Role 상수
    private static final String ROLE_ADMIN        = "ROLE_ADMIN";
    private static final String ROLE_DEPT_MANAGER = "ROLE_DEPT_MANAGER";
    private static final String ROLE_USER         = "ROLE_USER";

    private final String       eno;     // 사번
    private final List<String> athIds;  // 자격등급 ID 목록 (다중 가능)
    private final String       bbrC;    // 소속 부서코드

    private final Collection<? extends GrantedAuthority> authorities;

    /**
     * @param eno    사번
     * @param athIds 자격등급 ID 목록 (null 또는 빈 리스트이면 ITPZZ001 기본값 적용)
     * @param bbrC   소속 부서코드
     */
    public CustomUserDetails(String eno, List<String> athIds, String bbrC) {
        this.eno    = eno;
        this.bbrC   = bbrC;

        // null/빈 리스트 방어: 기본값 일반사용자
        this.athIds = (athIds != null && !athIds.isEmpty())
            ? List.copyOf(athIds)
            : List.of(ATH_USER);

        // 모든 자격등급에 대응하는 Role을 authorities에 등록
        this.authorities = this.athIds.stream()
            .map(athId -> new SimpleGrantedAuthority(mapRole(athId)))
            .distinct()
            .collect(Collectors.toUnmodifiableList());
    }

    /** athId → Spring Security Role 변환 */
    private String mapRole(String athId) {
        return switch (athId) {
            case ATH_ADMIN    -> ROLE_ADMIN;
            case ATH_DEPT_MGR -> ROLE_DEPT_MANAGER;
            default           -> ROLE_USER;
        };
    }

    // -------------------------------------------------------------------------
    // 권한 확인 편의 메서드 (최상위 권한 우선: Admin > DeptMgr > User)
    // -------------------------------------------------------------------------

    /** 시스템관리자 여부 (ITPAD001 포함 시) */
    public boolean isAdmin() {
        return athIds.contains(ATH_ADMIN);
    }

    /**
     * 부서 관리 권한 여부
     * ITPZZ002(기획통할담당자) 또는 ITPAD001(시스템관리자) 포함 시 true
     * → 관리자는 부서 관리 권한도 포함
     */
    public boolean isDeptManager() {
        return athIds.contains(ATH_DEPT_MGR) || isAdmin();
    }

    /** 특정 자격등급 보유 여부 확인 */
    public boolean hasAthId(String athId) {
        return athIds.contains(athId);
    }

    // UserDetails 필수 구현 (Stateless이므로 단순 반환)
    @Override public String getUsername()              { return eno; }
    @Override public String getPassword()              { return ""; }
    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}
```

### 2.4 `JwtUtil.java` 변경 (배열 클레임)

```java
/**
 * Access Token 생성 (다중 자격등급 클레임 포함)
 *
 * @param eno    사번 (subject)
 * @param athIds 자격등급 ID 목록 (예: ["ITPZZ001", "ITPZZ002"])
 * @param bbrC   소속 부서코드
 * @return 서명된 JWT Access Token 문자열
 */
public String generateAccessToken(String eno, List<String> athIds, String bbrC) {
    Date now        = new Date();
    Date expiryDate = new Date(now.getTime() + accessTokenValidityMs);

    // athIds가 null/빈 리스트이면 기본값 ITPZZ001 적용
    List<String> effectiveAthIds = (athIds != null && !athIds.isEmpty())
        ? athIds
        : List.of("ITPZZ001");

    return Jwts.builder()
            .subject(eno)
            .claim("athIds", effectiveAthIds)  // List<String> → JSON 배열로 직렬화
            .claim("bbrC",   bbrC)
            .issuedAt(now)
            .expiration(expiryDate)
            .signWith(secretKey)
            .compact();
}

/**
 * JWT 토큰에서 자격등급 ID 목록 추출
 * JJWT는 List 클레임을 List<String>으로 역직렬화합니다.
 *
 * @param token JWT 토큰 문자열
 * @return 자격등급 ID 목록 (없으면 빈 리스트)
 */
@SuppressWarnings("unchecked")
public List<String> getAthIdsFromToken(String token) {
    Object claim = getClaims(token).get("athIds");
    if (claim instanceof List<?>) {
        return (List<String>) claim;
    }
    return List.of();
}

/** JWT 토큰에서 부서코드 추출 */
public String getBbrCFromToken(String token) {
    return (String) getClaims(token).get("bbrC");
}

// 내부 헬퍼: Claims 파싱
private Claims getClaims(String token) {
    return Jwts.parser().verifyWith(secretKey).build()
               .parseSignedClaims(token).getPayload();
}
```

> **기존 `generateAccessToken(String eno)` 시그니처 변경 영향**:
> `AuthService.login()`, `AuthService.refresh()` 호출부 수정 필요

### 2.5 `JwtAuthenticationFilter.java` 변경

```java
// 변경 전
UserDetails userDetails = userDetailsService.loadUserByUsername(eno);

// 변경 후 (DB 재조회 없이 JWT 클레임 직접 활용, 다중 자격등급 지원)
List<String> athIds = jwtUtil.getAthIdsFromToken(jwt);
String       bbrC   = jwtUtil.getBbrCFromToken(jwt);
CustomUserDetails userDetails = new CustomUserDetails(eno, athIds, bbrC);
```

> `CustomUserDetailsService` 의존성 제거 (`JwtAuthenticationFilter`에서 불필요)
> → `CustomUserDetailsService`는 Spring Security `DaoAuthenticationProvider`용으로만 유지

### 2.6 `AuthService.java` 변경

#### `login()` 변경 사항

```java
// 사용자의 모든 활성 자격등급 조회 (다중 자격등급)
List<String> athIds = croleIRepository
    .findAllByIdEnoAndUseYnAndDelYn(eno, "Y", "N")
    .stream()
    .map(CroleI::getAthId)
    .collect(Collectors.toList());

// 미등록 사용자 기본값: 일반사용자
if (athIds.isEmpty()) {
    athIds = List.of("ITPZZ001");
}

String bbrC = user.getBbrC();

String accessToken  = jwtUtil.generateAccessToken(eno, athIds, bbrC);
String refreshToken = jwtUtil.generateRefreshToken(eno);
```

#### `refresh()` 변경 사항

```java
// Refresh 시에도 최신 자격등급 반영 (자격등급 변경 즉시 반영)
String eno  = jwtUtil.getEnoFromToken(refreshToken);
CuserI user = cuserIRepository.findByEno(eno).orElseThrow(...);

List<String> athIds = croleIRepository
    .findAllByIdEnoAndUseYnAndDelYn(eno, "Y", "N")
    .stream()
    .map(CroleI::getAthId)
    .collect(Collectors.toList());

if (athIds.isEmpty()) {
    athIds = List.of("ITPZZ001");
}

String newAccessToken = jwtUtil.generateAccessToken(eno, athIds, user.getBbrC());
```

### 2.7 `AuthDto.java` 변경 — `LoginResponse`

```java
// 변경 전
@Schema(description = "자격등급 ID")
private String athId;

// 변경 후 (다중 자격등급)
@Schema(description = "자격등급 ID 목록 (예: [\"ITPZZ001\", \"ITPZZ002\"])")
private List<String> athIds;

@Schema(description = "소속 부서코드")
private String bbrC;
```

### 2.8 `SecurityConfig.java` 변경

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/auth/**", "/swagger-ui/**", ...).permitAll()
    .requestMatchers("/api/admin/**").hasRole("ADMIN")  // 관리자 전용 URL
    .anyRequest().authenticated()
)
```

### 2.9 서비스 레이어 권한 검증 패턴

#### 공통 헬퍼

```java
/** SecurityContextHolder에서 현재 인증 사용자 CustomUserDetails 추출 */
private CustomUserDetails getCurrentUser() {
    return (CustomUserDetails) SecurityContextHolder
        .getContext().getAuthentication().getPrincipal();
}
```

#### 조회 권한 필터링 패턴

```java
public List<ProjectDto.Response> getProjects(...) {
    CustomUserDetails currentUser = getCurrentUser();

    if (currentUser.isAdmin()) {
        return projectRepository.findAll(...);        // 전체 조회
    } else {
        return projectRepository.findByBbrC(currentUser.getBbrC(), ...);  // 소속 부서만
    }
}
```

#### 수정/삭제 권한 검증 패턴

```java
private void validateModifyPermission(String resourceBbrC, String resourceCreatorEno) {
    CustomUserDetails currentUser = getCurrentUser();

    if (currentUser.isAdmin()) return;  // ITPAD001: 모든 컨텐츠 수정 가능

    if (currentUser.isDeptManager()) {  // ITPZZ002 또는 ITPAD001
        if (!currentUser.getBbrC().equals(resourceBbrC)) {
            throw new CustomGeneralException("소속 부서의 컨텐츠만 수정/삭제할 수 있습니다.");
        }
        return;
    }

    // ITPZZ001: 본인 작성 컨텐츠만
    if (!currentUser.getEno().equals(resourceCreatorEno)) {
        throw new CustomGeneralException("본인이 작성한 컨텐츠만 수정/삭제할 수 있습니다.");
    }
}
```

---

## 3. 프론트엔드 상세 설계

### 3.1 `types/auth.ts` 변경 (배열 타입)

```typescript
export interface LoginResponse {
    eno: string;
    empNm: string;
    athIds: string[];  // 변경: 단일 → 배열 (다중 자격등급)
    bbrC: string;
}

export interface User {
    eno: string;
    empNm: string;
    athIds: string[];  // 변경: 단일 → 배열 (다중 자격등급)
    bbrC: string;
}

// 자격등급 ID 상수
export const ROLE = {
    USER:         'ITPZZ001',
    DEPT_MANAGER: 'ITPZZ002',
    ADMIN:        'ITPAD001',
} as const;

export type AthId = typeof ROLE[keyof typeof ROLE];
```

### 3.2 `stores/auth.ts` 변경

```typescript
const setAuth = (data: LoginResponse) => {
    user.value = {
        eno:    data.eno,
        empNm:  data.empNm,
        athIds: data.athIds ?? ['ITPZZ001'],  // 다중 자격등급 배열 저장, null 방어
        bbrC:   data.bbrC,
    };
};
```

### 3.3 `composables/useAuth.ts` 변경

```typescript
import { ROLE } from '~/types/auth';

export const useAuth = () => {
    const store = useAuthStore();
    const { user, isAuthenticated } = storeToRefs(store);

    // -------------------------------------------------------------------------
    // 권한 헬퍼 함수 (다중 자격등급 배열 기반)
    // -------------------------------------------------------------------------

    /** 시스템관리자 여부 (athIds에 ITPAD001 포함) */
    const isAdmin = (): boolean =>
        user.value?.athIds?.includes(ROLE.ADMIN) ?? false;

    /**
     * 부서 관리 권한 여부
     * ITPZZ002(기획통할담당자) 또는 ITPAD001(시스템관리자) 포함 시 true
     */
    const isDeptManager = (): boolean =>
        user.value?.athIds?.some(id => id === ROLE.DEPT_MANAGER || id === ROLE.ADMIN) ?? false;

    /** 일반사용자 여부 (Admin/DeptMgr 권한 미보유 시) */
    const isUser = (): boolean => !isAdmin() && !isDeptManager();

    /** 특정 자격등급 보유 여부 */
    const hasRole = (athId: string): boolean =>
        user.value?.athIds?.includes(athId) ?? false;

    /**
     * 수정/삭제 권한 확인
     * @param creatorEno   컨텐츠 최초 작성자 사번
     * @param resourceBbrC 컨텐츠 소속 부서코드
     */
    const canModify = (creatorEno: string, resourceBbrC?: string): boolean => {
        if (!user.value) return false;
        if (isAdmin()) return true;
        if (isDeptManager()) return resourceBbrC === user.value.bbrC;
        return creatorEno === user.value.eno;
    };

    return {
        user,
        isAuthenticated,
        login:          store.login,
        logout:         store.logout,
        refresh:        store.refresh,
        restoreSession: store.restoreSession,
        // 신규 권한 헬퍼
        isAdmin,
        isDeptManager,
        isUser,
        hasRole,
        canModify,
    };
};
```

### 3.4 `components/AppSidebar.vue` 변경

```vue
<script setup lang="ts">
const { isAdmin } = useAuth();
</script>

<template>
  <!-- 관리자 메뉴: ITPAD001 보유자만 노출 -->
  <li v-if="isAdmin()">
    <NuxtLink to="/admin">관리자</NuxtLink>
  </li>
</template>
```

### 3.5 `middleware/auth.global.ts` 변경

```typescript
export default defineNuxtRouteMiddleware((to) => {
    const { isAuthenticated, isAdmin } = useAuth();

    if (!isAuthenticated.value && to.path !== '/login') {
        return navigateTo('/login');
    }

    if (to.path.startsWith('/admin') && !isAdmin()) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    }
});
```

### 3.6 페이지별 수정/삭제 버튼 조건

```vue
<script setup lang="ts">
const { canModify } = useAuth();
</script>

<template>
  <Button
    v-if="canModify(project.fstEnrUsid, project.bbrC)"
    label="수정"
    @click="openEdit"
  />
  <Button
    v-if="canModify(project.fstEnrUsid, project.bbrC)"
    label="삭제"
    severity="danger"
    @click="confirmDelete"
  />
</template>
```

---

## 4. API 변경 명세

### 4.1 POST /api/auth/login — 응답 변경

```json
// 변경 전
{
  "eno": "12345678",
  "empNm": "홍길동"
}

// 변경 후 (다중 자격등급)
{
  "eno": "12345678",
  "empNm": "홍길동",
  "athIds": ["ITPZZ001", "ITPZZ002"],
  "bbrC": "101"
}
```

### 4.2 조회 API — 권한별 응답 범위

| 엔드포인트 | 일반/기획통할 (비관리자) | ROLE_ADMIN |
|-----------|----------------------|-----------|
| `GET /api/projects` | 소속 부서 데이터만 | 전체 데이터 |
| `GET /api/cost` | 소속 부서 데이터만 | 전체 데이터 |
| `GET /api/applications` | 소속 부서 데이터만 | 전체 데이터 |

### 4.3 수정/삭제 API — 권한 오류 응답

```json
// HTTP 400 Bad Request (CustomGeneralException)
{ "message": "소속 부서의 컨텐츠만 수정/삭제할 수 있습니다." }
{ "message": "본인이 작성한 컨텐츠만 수정/삭제할 수 있습니다." }
```

---

## 5. 데이터 모델

### 5.1 엔티티 관계도 (1사용자 N자격등급)

```
TAAABB_CUSERI (CuserI)
  ENO  ─────────────────────────┐
  BBR_C                         │ (1:N 관계)
                                ↓
TAAABB_CROLEI (CroleI)     ← 1사용자 N행 가능
  ENO (FK → CUSERI.ENO)
  ATH_ID ──────────────────────→ TAAABB_CAUTHI (CauthI)
                                    ATH_ID (PK)
                                    QLF_GR_NM

예시 데이터:
  ENO=12345678, ATH_ID=ITPZZ001  ← 일반사용자
  ENO=12345678, ATH_ID=ITPZZ002  ← 기획통할담당자 (동일 ENO, 다른 ATH_ID)
```

### 5.2 JWT Payload 구조 (배열 클레임)

```json
{
  "sub": "12345678",
  "athIds": ["ITPZZ001", "ITPZZ002"],  // 배열 (단일 자격등급이어도 배열 형식 유지)
  "bbrC": "101",
  "iat": 1745000000,
  "exp": 1745000900
}
```

### 5.3 권한 매핑 테이블

| athIds 포함 값 | isAdmin() | isDeptManager() | 조회 범위 | 수정 범위 |
|--------------|-----------|-----------------|---------|---------|
| `["ITPZZ001"]` | false | false | 소속 부서 | 본인 작성 |
| `["ITPZZ002"]` | false | true | 소속 부서 | 소속 부서 |
| `["ITPAD001"]` | true | true | 전체 | 전체 |
| `["ITPZZ001","ITPZZ002"]` | false | true | 소속 부서 | 소속 부서 |
| `["ITPZZ002","ITPAD001"]` | true | true | 전체 | 전체 |

---

## 6. 구현 체크리스트

### 6.1 백엔드

- [ ] `CroleIId.java` 생성 (복합키 Embeddable)
- [ ] `CauthI.java` 생성
- [ ] `CroleI.java` 생성
- [ ] `CauthIRepository.java` 생성
- [ ] `CroleIRepository.java` 생성 (`findAllByIdEnoAndUseYnAndDelYn` — List 반환)
- [ ] `CustomUserDetails.java` 생성 (`athIds` List, `isAdmin()`, `isDeptManager()`, `hasAthId()`)
- [ ] `JwtUtil.java` 수정 (`generateAccessToken(eno, List<String> athIds, bbrC)`, `getAthIdsFromToken`, `getBbrCFromToken`)
- [ ] `JwtAuthenticationFilter.java` 수정 (`getAthIdsFromToken` → `CustomUserDetails(eno, athIds, bbrC)`)
- [ ] `AuthService.java` 수정 (`login()` — `findAllBy` 리스트 조회, `refresh()` — 동일)
- [ ] `AuthDto.LoginResponse` 수정 (`athIds: List<String>`, `bbrC`)
- [ ] `SecurityConfig.java` 수정 (`/api/admin/**` ROLE_ADMIN)
- [ ] `ProjectService.java` 수정 (조회 필터 + `validateModifyPermission`)
- [ ] `ApplicationService.java` 수정 (조회 필터 + `validateModifyPermission`)
- [ ] `BrdocmService.java` 수정 (조회 필터 + `validateModifyPermission`)
- [ ] `BgdocmService.java` 수정 (조회 필터 + `validateModifyPermission`)
- [ ] `CostService.java` 수정 (조회 필터 + `validateModifyPermission`)

### 6.2 프론트엔드

- [ ] `types/auth.ts` 수정 (`athIds: string[]`, `bbrC`, ROLE 상수)
- [ ] `stores/auth.ts` 수정 (`setAuth` — `athIds` 배열 저장, null 방어)
- [ ] `composables/useAuth.ts` 수정 (`isAdmin`, `isDeptManager`, `isUser`, `hasRole`, `canModify`)
- [ ] `components/AppSidebar.vue` 수정 (`v-if="isAdmin()"`)
- [ ] `middleware/auth.global.ts` 수정 (`/admin/**` 경로 보호)
- [ ] `pages/info/projects/[id].vue` 수정 (`v-if="canModify(...)"`)
- [ ] `pages/info/projects/form.vue` 수정
- [ ] `pages/info/projects/ordinary/index.vue` 수정
- [ ] `pages/info/projects/ordinary/form.vue` 수정
- [ ] `pages/budget/index.vue` 수정
- [ ] `pages/budget/list.vue` 수정
- [ ] `pages/budget/approval.vue` 수정
