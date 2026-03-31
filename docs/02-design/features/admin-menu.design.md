# admin-menu Design — 관리자 메뉴 신설 상세 설계

> Plan 참조: `docs/01-plan/features/admin-menu.plan.md`
> 선택 아키텍처: Option C — Pragmatic (단일 Admin 도메인)

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | DB 직접 접근 없이 시스템 운영 데이터(공통코드·사용자·조직·역할)를 UI로 관리하기 위함 |
| WHO | 시스템관리자(ITPAD001 역할 보유자) — 3,000명 임직원 중 극소수 |
| RISK | rbac 미완성 시 관리자 메뉴 접근 제어 불가 / JWT 토큰 테이블명 PRD 오기 확인 완료 |
| SUCCESS | 9개 관리 화면 정상 작동 + ITPAD001만 메뉴 노출 + 인라인 편집 저장 성공 |
| SCOPE | 프론트(Nuxt 4 pages/admin/**) + 백엔드(common/admin/** API) |

---

## 1. 아키텍처 개요

### 1.1 핵심 설계 원칙

코드베이스 분석 결과, **기존 패키지에 이미 필요한 엔티티/리포지토리가 모두 존재**한다.

| 기능 | 기존 패키지 (엔티티/리포지토리) | 신규 Admin 레이어 |
|------|-------------------------------|-----------------|
| 공통코드 | `common/code/` (Ccodem, CodeRepository) | AdminController → AdminService |
| 자격등급 | `common/iam/` (CauthI, AuthRepository) | AdminController → AdminService |
| 사용자 | `common/iam/` (CuserI, UserService) | AdminController → AdminService |
| 조직 | `common/iam/` (CorgnI, OrganizationService) | AdminController → AdminService |
| 역할 | `common/iam/` (CroleI, RoleRepository) | AdminController → AdminService |
| 로그인 이력 | `common/system/` (Clognh, LoginHistoryService) | AdminController → AdminService |
| JWT 토큰 | `common/system/` (Crtokm, RefreshTokenRepository) | AdminController → AdminService |
| 첨부파일 | `infra/file/` (Cfilem, FileRepository) | AdminController → AdminService |

**AdminService는 기존 리포지토리/서비스를 DI 받아 사용** — 엔티티/리포지토리 중복 없음.

### 1.2 전체 흐름

```
[프론트: pages/admin/*.vue]
  └→ useAdminApi.ts (composable)
       └→ $apiFetch / useApiFetch → /api/admin/**

[백엔드: common/admin/]
  AdminController
    └→ @PreAuthorize("hasRole('ROLE_ADMIN')")  ← rbac: ITPAD001 = ROLE_ADMIN
    └→ AdminService
         ├→ CodeRepository          (common/code/)
         ├→ AuthRepository          (common/iam/)
         ├→ UserService             (common/iam/)
         ├→ OrganizationRepository  (common/iam/)
         ├→ RoleRepository          (common/iam/)
         ├→ LoginHistoryRepository  (common/system/)
         ├→ RefreshTokenRepository  (common/system/)
         └→ FileRepository          (infra/file/)

[접근 제어]
  미들웨어: app/middleware/admin.ts
    └→ authStore.user.athIds?.includes('ITPAD001') 확인
    └→ false이면 → navigateTo('/')
```

### 1.3 rbac 의존성 명시

admin-menu는 rbac 피처의 완료를 전제로 한다.

| rbac 구현 사항 | admin-menu 활용 방식 |
|--------------|-------------------|
| JWT 클레임에 `athIds: string[]` 포함 | 프론트: `user.athIds?.includes('ITPAD001')` |
| Spring Security `ROLE_ADMIN` 등록 | 백엔드: `@PreAuthorize("hasRole('ROLE_ADMIN')")` |
| `CustomUserDetails.isAdmin()` 메서드 | AdminService에서 추가 검증 시 활용 |

---

## 2. 백엔드 상세 설계

### 2.1 패키지 구조

```
src/main/java/com/kdb/it/
└── common/
    └── admin/
        ├── controller/
        │   └── AdminController.java
        ├── service/
        │   └── AdminService.java
        └── dto/
            └── AdminDto.java
```

> Repository는 신규 생성 없음 — 기존 리포지토리 재사용.

### 2.2 AdminController.java

```java
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ROLE_ADMIN')")  // 모든 메서드에 ROLE_ADMIN 요구
@RequiredArgsConstructor
@Tag(name = "Admin", description = "시스템 관리자 전용 API")
public class AdminController {

    private final AdminService adminService;

    // ===== 공통코드 =====
    @GetMapping("/codes")
    public ResponseEntity<List<AdminDto.CodeResponse>> getCodes() { ... }
    @PostMapping("/codes")
    public ResponseEntity<Void> createCode(@RequestBody AdminDto.CodeRequest req) { ... }
    @PutMapping("/codes/{cId}")
    public ResponseEntity<Void> updateCode(@PathVariable String cId, @RequestBody AdminDto.CodeRequest req) { ... }
    @DeleteMapping("/codes/{cId}")
    public ResponseEntity<Void> deleteCode(@PathVariable String cId) { ... }

    // ===== 자격등급 =====
    @GetMapping("/auth-grades")
    @PostMapping("/auth-grades")
    @PutMapping("/auth-grades/{athId}")
    @DeleteMapping("/auth-grades/{athId}")

    // ===== 사용자 =====
    @GetMapping("/users")
    @PostMapping("/users")
    @PutMapping("/users/{eno}")
    @DeleteMapping("/users/{eno}")

    // ===== 조직 =====
    @GetMapping("/organizations")
    @PostMapping("/organizations")
    @PutMapping("/organizations/{orgC}")
    @DeleteMapping("/organizations/{orgC}")

    // ===== 역할 =====
    @GetMapping("/roles")
    @PostMapping("/roles")
    @PutMapping("/roles/{athId}/{eno}")
    @DeleteMapping("/roles/{athId}/{eno}")

    // ===== 조회 전용 =====
    @GetMapping("/login-history")   // 페이지네이션: ?page=0&size=50
    @GetMapping("/tokens")
    @GetMapping("/files")

    // ===== 대시보드 =====
    @GetMapping("/dashboard/login-stats")  // 일별 로그인 건수
}
```

### 2.3 AdminService.java — 주요 메서드

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    // 기존 리포지토리/서비스 주입
    private final CodeRepository codeRepository;
    private final AuthRepository authRepository;           // CauthI
    private final UserService userService;                  // CuserI (기존 서비스 재사용)
    private final OrganizationRepository orgRepository;    // CorgnI
    private final RoleRepository roleRepository;           // CroleI
    private final LoginHistoryRepository loginHistoryRepo; // Clognh
    private final RefreshTokenRepository tokenRepository;  // Crtokm
    private final FileRepository fileRepository;           // Cfilem (infra/file)

    // ===== 공통 처리 =====
    // 사원번호 → 이름 변환: CuserI에서 조회하여 usrNm 반환
    private String resolveUserName(String eno) { ... }

    // ===== 공통코드 =====
    public List<AdminDto.CodeResponse> getCodes() {
        // DEL_YN='N' 조건 + FST_ENR_USID, LST_CHG_USID → resolveUserName 변환
    }
    @Transactional
    public void createCode(AdminDto.CodeRequest req) {
        // C_ID 중복 체크 → Ccodem 엔티티 저장
    }
    @Transactional
    public void updateCode(String cId, AdminDto.CodeRequest req) {
        // Dirty Checking 활용 → save() 불필요
    }
    @Transactional
    public void deleteCode(String cId) {
        // Soft Delete: DEL_YN='Y'
    }

    // ===== 로그인 통계 (대시보드) =====
    public List<AdminDto.LoginStatResponse> getLoginStats() {
        // TAAABB_CLOGNH에서 날짜별 집계 (최근 30일)
        // @Query(nativeQuery = true) 사용
    }
}
```

### 2.4 AdminDto.java — Static Nested Class 구조

```java
public class AdminDto {

    // 공통코드 --------------------------------------------------
    @Schema(name = "AdminDto.CodeRequest")
    public record CodeRequest(
        @NotBlank String cId,
        String cNm, String cdva, String cDes,
        String cttTp, String cttTpDes,
        LocalDate sttDt, LocalDate endDt,
        Integer cSqn
    ) {}

    @Schema(name = "AdminDto.CodeResponse")
    public record CodeResponse(
        String cId, String cNm, String cdva, String cDes,
        String cttTp, String cttTpDes,
        LocalDate sttDt, LocalDate endDt, Integer cSqn,
        LocalDateTime fstEnrDtm, String fstEnrUsid, String fstEnrUsNm,  // 이름 포함
        LocalDateTime lstChgDtm, String lstChgUsid, String lstChgUsNm   // 이름 포함
    ) {}

    // 자격등급 --------------------------------------------------
    public record AuthGradeRequest(String athId, String qlfGrNm, String qlfGrMat, String useYn) {}
    public record AuthGradeResponse(...이름 포함...) {}

    // 사용자 ---------------------------------------------------
    public record UserRequest(String eno, String usrNm, String ptCNm, String temC,
                               String etrMilAddrNm, String inleNo, String cpnTpn, String bbrC) {}
    public record UserResponse(...조직 join 정보 포함...) {}

    // 조직 -----------------------------------------------------
    public record OrgRequest(...) {}
    public record OrgResponse(...이름 포함...) {}

    // 역할 -----------------------------------------------------
    public record RoleRequest(String athId, String eno, String useYn) {}
    public record RoleResponse(...이름 포함...) {}

    // 로그인 이력 (조회 전용) -----------------------------------
    public record LoginHistoryResponse(
        String eno, String usrNm,  // 이름 포함
        LocalDateTime lgnDtm, String lgnTp, String ipAddr,
        String flurRsn, String ustAgt
    ) {}

    // JWT 토큰 (조회 전용) -------------------------------------
    public record TokenResponse(
        String eno, String usrNm,  // 이름 포함
        LocalDateTime endDtm,
        String tokMasked,           // 앞 20자 + "..." 마스킹
        LocalDateTime fstEnrDtm
    ) {}

    // 첨부파일 (조회 전용) -------------------------------------
    public record FileResponse(
        String flMngNo, String orcFlNm, String flDtt, String orcDtt,
        LocalDateTime fstEnrDtm, String fstEnrUsid, String fstEnrUsNm
    ) {}

    // 대시보드 통계 -------------------------------------------
    public record LoginStatResponse(
        LocalDate date,   // 날짜
        Long count        // 로그인 건수
    ) {}
}
```

### 2.5 Spring Security 설정 추가

```java
// SecurityConfig.java에 추가
.requestMatchers("/api/admin/**").hasRole("ROLE_ADMIN")
// 또는 각 메서드에 @PreAuthorize 사용 (현재 설계 채택)
```

---

## 3. 프론트엔드 상세 설계

### 3.1 파일 구조

```
app/
├── pages/
│   └── admin/
│       ├── index.vue              ← /admin → /admin/dashboard 리다이렉트
│       ├── dashboard.vue          ← 대시보드 (진입점, Chart.js)
│       ├── codes.vue              ← 공통코드 관리
│       ├── auth-grades.vue        ← 자격등급 관리
│       ├── users.vue              ← 사용자 관리
│       ├── organizations.vue      ← 조직 관리
│       ├── roles.vue              ← 역할 관리
│       ├── login-history.vue      ← 로그인 이력
│       ├── tokens.vue             ← JWT 토큰 조회
│       └── files.vue              ← 첨부파일 조회
├── layouts/
│   └── admin.vue                  ← 관리자 전용 레이아웃 (좌측 사이드 서브메뉴)
├── middleware/
│   └── admin.ts                   ← ITPAD001 권한 체크
└── composables/
    └── useAdminApi.ts             ← 관리자 API 공통 composable
```

### 3.2 middleware/admin.ts

```typescript
// 관리자 전용 미들웨어 — ITPAD001 역할 보유자만 접근 허용
export default defineNuxtRouteMiddleware(() => {
    const { user } = useAuth();
    if (!user.value?.athIds?.includes('ITPAD001')) {
        return navigateTo('/');
    }
});
```

> 각 admin 페이지에 `definePageMeta({ middleware: 'admin', layout: 'admin' })` 설정.

### 3.3 layouts/admin.vue

```
┌──────────────┬──────────────────────────────────┐
│  AppSidebar  │  AppHeader                        │
│  (기존)       ├──────────────────────────────────┤
│              │ [관리자 서브메뉴 탭]                 │
│              │  대시보드 | 공통코드 | 자격등급 | ...  │
│              ├──────────────────────────────────┤
│              │  <slot /> (페이지 콘텐츠)           │
│              ├──────────────────────────────────┤
│              │  Footer                           │
└──────────────┴──────────────────────────────────┘
```

- 기존 `default.vue` 레이아웃 구조를 상속하여 상단에 관리자 서브메뉴 탭 추가
- PrimeVue `<TabMenu>` 컴포넌트로 9개 메뉴 항목 표시

### 3.4 AppHeader.vue 수정 — [관리자] 메뉴 추가

```typescript
// 기존 items 배열 끝에 추가 (조건부 렌더링)
const isAdmin = computed(() => user.value?.athIds?.includes('ITPAD001'));

// template에서 조건부 렌더링
// items 배열을 computed로 변환하여 isAdmin 시 관리자 메뉴 추가
const menuItems = computed(() => [
    ...기존 메뉴 items,
    ...(isAdmin.value ? [{
        label: '관리자',
        root: true,
        icon: 'crown',   // 노란색 왕관 SVG — 커스텀 아이콘 슬롯 사용
        command: () => navigateTo('/admin/dashboard')
    }] : [])
]);
```

**왕관 SVG 아이콘**: PrimeVue MegaMenu의 `#item` 슬롯 활용하여 커스텀 SVG 삽입.

### 3.5 composables/useAdminApi.ts

```typescript
export const useAdminApi = () => {
    const { $apiFetch } = useNuxtApp();
    const config = useRuntimeConfig();

    // ===== 공통코드 =====
    const fetchCodes = () => useApiFetch<AdminCodeResponse[]>('/api/admin/codes');
    const createCode = (body: AdminCodeRequest) =>
        $apiFetch('/api/admin/codes', { method: 'POST', body });
    const updateCode = (cId: string, body: AdminCodeRequest) =>
        $apiFetch(`/api/admin/codes/${cId}`, { method: 'PUT', body });
    const deleteCode = (cId: string) =>
        $apiFetch(`/api/admin/codes/${cId}`, { method: 'DELETE' });

    // ===== 자격등급 / 사용자 / 조직 / 역할 =====
    // (동일 패턴 반복)

    // ===== 조회 전용 =====
    const fetchLoginHistory = (page = 0, size = 50) =>
        useApiFetch('/api/admin/login-history', { query: { page, size } });
    const fetchTokens = () => useApiFetch('/api/admin/tokens');
    const fetchFiles = () => useApiFetch('/api/admin/files');

    // ===== 대시보드 =====
    const fetchLoginStats = () => useApiFetch('/api/admin/dashboard/login-stats');

    return {
        fetchCodes, createCode, updateCode, deleteCode,
        // ... 각 기능별 메서드
        fetchLoginHistory, fetchTokens, fetchFiles, fetchLoginStats
    };
};
```

### 3.6 페이지 공통 패턴 — CRUD 화면

모든 CRUD 관리 화면(codes, auth-grades, users, organizations, roles)은 동일한 구조:

```vue
<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' });

const { fetchXxx, createXxx, updateXxx, deleteXxx } = useAdminApi();
const { data, refresh } = await fetchXxx();
const editingRows = ref([]);

// 인라인 편집 저장 — 행 단위 즉시 저장
const onRowEditSave = async (event: DataTableRowEditSaveEvent) => {
    const { newData } = event;
    await updateXxx(newData.id, newData);
    await refresh();
};

// 행 삭제 — Soft Delete
const onDelete = async (id: string) => {
    await deleteXxx(id);
    await refresh();
};

// 이름 클릭 → 직원정보 팝업
const employeeDialogVisible = ref(false);
const selectedEno = ref('');
const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};
</script>

<template>
    <DataTable :value="data" editMode="row" v-model:editingRows="editingRows"
               @row-edit-save="onRowEditSave" dataKey="id">
        <!-- GUID, GUID_PRG_SNO 컬럼 제외 -->
        <Column field="cId" header="코드ID" />
        <Column field="cNm" header="코드명">
            <template #editor="{ data, field }">
                <InputText v-model="data[field]" />
            </template>
        </Column>
        <!-- 이름 컬럼: 클릭 시 직원정보 팝업 -->
        <Column field="fstEnrUsNm" header="최초생성자">
            <template #body="{ data }">
                <span class="cursor-pointer text-blue-500 hover:underline"
                      @click="showEmployeeDialog(data.fstEnrUsid)">
                    {{ data.fstEnrUsNm }}
                </span>
            </template>
        </Column>
        <Column rowEditor />
        <Column>
            <template #body="{ data }">
                <Button icon="pi pi-trash" severity="danger" text @click="onDelete(data.id)" />
            </template>
        </Column>
    </DataTable>

    <!-- 직원정보 팝업 — 기존 EmployeeSearchDialog 재사용 -->
    <EmployeeSearchDialog v-model:visible="employeeDialogVisible" :eno="selectedEno" />
</template>
```

### 3.7 대시보드 화면 (dashboard.vue)

```vue
<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' });

const { fetchLoginStats } = useAdminApi();
const { data: stats } = await fetchLoginStats();

// Chart.js 데이터 변환 (PrimeVue <Chart> 컴포넌트 사용)
const chartData = computed(() => ({
    labels: stats.value?.map(s => s.date) ?? [],
    datasets: [{
        label: '일별 로그인 건수',
        data: stats.value?.map(s => s.count) ?? [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
    }]
}));
</script>

<template>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 접속자 수 추이 차트 -->
        <Card>
            <template #title>접속자 수 추이 (최근 30일)</template>
            <template #content>
                <Chart type="line" :data="chartData" class="h-64" />
            </template>
        </Card>

        <!-- 서버 자원 사용량 — 1차: 미구현 플레이스홀더 -->
        <Card>
            <template #title>서버 자원 사용량</template>
            <template #content>
                <p class="text-zinc-400">준비 중 (차기 반영 예정)</p>
            </template>
        </Card>
    </div>
</template>
```

---

## 4. API 계약 (Contract)

### 4.1 전체 엔드포인트 목록

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /api/admin/codes | ROLE_ADMIN | 공통코드 목록 |
| POST | /api/admin/codes | ROLE_ADMIN | 공통코드 추가 |
| PUT | /api/admin/codes/{cId} | ROLE_ADMIN | 공통코드 수정 |
| DELETE | /api/admin/codes/{cId} | ROLE_ADMIN | 공통코드 삭제(Soft) |
| GET | /api/admin/auth-grades | ROLE_ADMIN | 자격등급 목록 |
| POST | /api/admin/auth-grades | ROLE_ADMIN | 자격등급 추가 |
| PUT | /api/admin/auth-grades/{athId} | ROLE_ADMIN | 자격등급 수정 |
| DELETE | /api/admin/auth-grades/{athId} | ROLE_ADMIN | 자격등급 삭제(Soft) |
| GET | /api/admin/users | ROLE_ADMIN | 사용자 목록 (조직 join) |
| POST | /api/admin/users | ROLE_ADMIN | 사용자 추가 |
| PUT | /api/admin/users/{eno} | ROLE_ADMIN | 사용자 수정 |
| DELETE | /api/admin/users/{eno} | ROLE_ADMIN | 사용자 삭제(Soft) |
| GET | /api/admin/organizations | ROLE_ADMIN | 조직 목록 |
| POST | /api/admin/organizations | ROLE_ADMIN | 조직 추가 |
| PUT | /api/admin/organizations/{orgC} | ROLE_ADMIN | 조직 수정 |
| DELETE | /api/admin/organizations/{orgC} | ROLE_ADMIN | 조직 삭제(Soft) |
| GET | /api/admin/roles | ROLE_ADMIN | 역할 목록 |
| POST | /api/admin/roles | ROLE_ADMIN | 역할 추가 |
| PUT | /api/admin/roles/{athId}/{eno} | ROLE_ADMIN | 역할 수정 |
| DELETE | /api/admin/roles/{athId}/{eno} | ROLE_ADMIN | 역할 삭제(Soft) |
| GET | /api/admin/login-history | ROLE_ADMIN | 로그인 이력 (페이지네이션) |
| GET | /api/admin/tokens | ROLE_ADMIN | JWT 토큰 목록 |
| GET | /api/admin/files | ROLE_ADMIN | 첨부파일 목록 |
| GET | /api/admin/dashboard/login-stats | ROLE_ADMIN | 일별 로그인 통계 |

### 4.2 공통 응답 형식

```json
// 목록 조회 (단순)
[{ "cId": "CD001", "cNm": "코드명", "fstEnrUsNm": "홍길동", ... }]

// 페이지네이션 (로그인 이력)
{
  "content": [...],
  "totalElements": 10000,
  "totalPages": 200,
  "number": 0,
  "size": 50
}
```

---

## 5. 데이터 모델

### 5.1 기존 엔티티 활용 (신규 생성 없음)

| 엔티티 | 파일 경로 | 비고 |
|--------|----------|------|
| Ccodem | `common/code/entity/Ccodem.java` | 공통코드 |
| CauthI | `common/iam/entity/CauthI.java` | 자격등급 |
| CuserI | `common/iam/entity/CuserI.java` | 사용자 |
| CorgnI | `common/iam/entity/CorgnI.java` | 조직 |
| CroleI | `common/iam/entity/CroleI.java` | 역할 (복합키: CroleIId) |
| Clognh | `common/system/entity/Clognh.java` | 로그인이력 |
| Crtokm | `common/system/entity/Crtokm.java` | JWT 리프레시 토큰 |
| Cfilem | `infra/file/entity/Cfilem.java` | 첨부파일 (경로 추정) |

### 5.2 이름 변환 처리 (공통)

ENO → 이름 변환은 서비스 레이어에서 처리:
```java
// AdminService 내부 헬퍼
private String resolveUserName(String eno) {
    if (eno == null) return null;
    return userRepository.findByEno(eno)
        .map(CuserI::getUsrNm)
        .orElse(eno);  // 사용자 없으면 eno 그대로 반환
}
```

---

## 6. 보안 설계

### 6.1 백엔드 접근 제어

```java
// 방법 1: 클래스 레벨 @PreAuthorize (채택)
@RestController
@PreAuthorize("hasRole('ROLE_ADMIN')")
public class AdminController { ... }

// 방법 2: SecurityConfig URL 패턴 (보조)
.requestMatchers("/api/admin/**").hasRole("ADMIN")
```

### 6.2 프론트엔드 접근 제어

```typescript
// middleware/admin.ts — 모든 /admin/** 라우트에 자동 적용
defineNuxtRouteMiddleware(() => {
    const { user } = useAuth();
    if (!user.value?.athIds?.includes('ITPAD001')) {
        return navigateTo('/');  // 비관리자 → 메인으로 리다이렉트
    }
});
```

### 6.3 JWT 토큰 마스킹

`TokenResponse.tokMasked` 필드: 토큰 앞 20자 + "..." 표시
```java
String tokMasked = tok.length() > 20 ? tok.substring(0, 20) + "..." : tok;
```

---

## 7. 테스트 계획

### 7.1 백엔드 테스트

| 테스트 | 파일 위치 | 검증 항목 |
|--------|----------|---------|
| AdminControllerTest | `src/test/.../common/admin/controller/` | 403 (비관리자), 200 (관리자), Soft Delete |
| AdminServiceTest | `src/test/.../common/admin/service/` | 이름 변환, 코드 CRUD, 통계 집계 |

### 7.2 프론트엔드 테스트

| 테스트 | 파일 위치 | 검증 항목 |
|--------|----------|---------|
| admin.spec.ts | `tests/e2e/admin.spec.ts` | 관리자 로그인 → 메뉴 노출, 비관리자 → 미노출 |
| admin-crud.spec.ts | `tests/e2e/admin-crud.spec.ts` | 인라인 편집 → 저장 → 새로고침 확인 |

---

## 8. 구현 가이드

### 8.1 모듈 맵

| 모듈 | 설명 | 파일 수 |
|------|------|--------|
| M1. 백엔드 공통 구조 | AdminController + AdminService + AdminDto | 3 |
| M2. 공통코드 CRUD | 백엔드 codes API + 프론트 codes.vue | 2 |
| M3. 자격등급 CRUD | 백엔드 auth-grades API + 프론트 auth-grades.vue | 2 |
| M4. 역할 CRUD | 백엔드 roles API + 프론트 roles.vue | 2 |
| M5. 사용자 CRUD | 백엔드 users API + 프론트 users.vue | 2 |
| M6. 조직 CRUD | 백엔드 organizations API + 프론트 organizations.vue | 2 |
| M7. 조회 전용 3종 | login-history, tokens, files + 프론트 3페이지 | 4 |
| M8. 대시보드 | login-stats API + dashboard.vue | 2 |
| M9. 네비게이션 | AppHeader 수정 + admin.vue 레이아웃 + admin.ts 미들웨어 + useAdminApi.ts | 4 |

### 8.2 Session Guide

| 세션 | 모듈 | 예상 작업 |
|------|------|---------|
| Session 1 | M1 + M2 + M9 | 백엔드 구조 + 공통코드 CRUD + 네비게이션 기반 |
| Session 2 | M3 + M4 + M5 | 자격등급 + 역할 + 사용자 CRUD |
| Session 3 | M6 + M7 + M8 | 조직 CRUD + 조회 3종 + 대시보드 |

> `/pdca do admin-menu --scope M1,M2,M9` 로 Session 1 범위만 구현 가능.

### 8.3 구현 순서 (Session 1 기준)

```
1. AdminDto.java — CodeRequest/CodeResponse 정의
2. AdminService.java — getCodes(), createCode(), updateCode(), deleteCode()
3. AdminController.java — /api/admin/codes CRUD 엔드포인트
4. app/middleware/admin.ts — 관리자 권한 체크
5. app/layouts/admin.vue — 관리자 레이아웃
6. app/composables/useAdminApi.ts — fetchCodes, createCode, updateCode, deleteCode
7. app/pages/admin/codes.vue — 공통코드 관리 화면
8. AppHeader.vue 수정 — [관리자] 메뉴 조건부 추가 (왕관 SVG)
9. app/pages/admin/index.vue — /admin/dashboard 리다이렉트
```
