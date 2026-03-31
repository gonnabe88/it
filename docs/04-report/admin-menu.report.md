# admin-menu Report — 관리자 메뉴 신설 완료 보고서

> 작성일: 2026-04-01
> PDCA 사이클: Plan → Design → Do (3 Sessions) → Check → Act → 완료

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | admin-menu (관리자 메뉴 신설) |
| 작성일 | 2026-04-01 |
| 단계 | 완료 (Report) |
| 최종 Match Rate | **100%** |
| 총 구현 파일 | 백엔드 5개 신규/수정 + 프론트 18개 신규/수정 |
| 총 API 엔드포인트 | 24개 (CRUD 20 + 조회 전용 4) |

### Value Delivered

| 관점 | 내용 |
|------|------|
| Problem | 시스템 운영 데이터(공통코드·사용자·조직·역할)를 DB 직접 접근 없이 관리할 방법이 없어 운영 효율이 낮았음 |
| Solution | 시스템관리자(ITPAD001) 전용 관리자 메뉴 신설 — 9개 관리 화면 제공 (CRUD 5종 + 조회 3종 + 대시보드 1종) |
| Function UX Effect | 인라인 편집·즉시 저장으로 빠른 데이터 수정, Chart.js 대시보드로 30일 접속 추이 시각화, 이름 클릭 직원정보 팝업으로 사용자 확인 편의성 향상 |
| Core Value | 비개발자 관리자가 UI를 통해 시스템 데이터를 직접 관리하여 운영 자립도 향상 및 장애 대응 시간 단축 |

---

## 1. 구현 범위

### 1.1 백엔드 구현

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `common/admin/controller/AdminController.java` | 신규 | 24개 엔드포인트, `@PreAuthorize("hasRole('ROLE_ADMIN')")` |
| `common/admin/service/AdminService.java` | 신규 | 8개 도메인 데이터 접근, 기존 Repository DI 재사용 |
| `common/admin/dto/AdminDto.java` | 신규 | 8개 Request/Response DTO |
| `common/iam/entity/CorgnI.java` | 수정 | `update()` 메서드 추가 (JPA Dirty Checking) |
| `common/system/repository/LoginHistoryRepository.java` | 수정 | `Page<>` 조회 + Oracle nativeQuery 일별 통계 |

### 1.2 프론트엔드 구현

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `layouts/admin.vue` | 신규 | 관리자 전용 레이아웃 + TabMenu 9개 탭 |
| `middleware/admin.ts` | 신규 | ITPAD001 접근 제어 미들웨어 |
| `composables/useAdminApi.ts` | 신규 | 24개 API 함수 + 7개 TypeScript 타입 |
| `pages/admin/index.vue` | 신규 | /admin → /admin/dashboard 리다이렉트 |
| `pages/admin/dashboard.vue` | 신규 | 요약 통계 카드 + 30일 라인 차트 |
| `pages/admin/codes.vue` | 신규 | 공통코드 CRUD (인라인 편집) |
| `pages/admin/auth-grades.vue` | 신규 | 자격등급 CRUD (인라인 편집) |
| `pages/admin/users.vue` | 신규 | 사용자 CRUD (인라인 편집) |
| `pages/admin/roles.vue` | 신규 | 역할 CRUD (인라인 편집) |
| `pages/admin/organizations.vue` | 신규 | 조직 CRUD (인라인 편집) |
| `pages/admin/login-history.vue` | 신규 | 로그인 이력 조회 + 페이지네이션 |
| `pages/admin/tokens.vue` | 신규 | JWT 갱신토큰 조회 (마스킹) |
| `pages/admin/files.vue` | 신규 | 첨부파일 조회 |

---

## 2. 구현 세션 이력

| 세션 | 범위 | 주요 내용 |
|------|------|----------|
| Session 1 (M1+M2) | 백엔드 + 인프라 | AdminController/Service/Dto, 레이아웃, 미들웨어, 공통코드 페이지 |
| Session 2 (M3+M4+M5) | 자격등급·역할·사용자 CRUD | auth-grades.vue, roles.vue, users.vue, useAdminApi 확장 |
| Session 3 (M6+M7+M8) | 조직·조회3종·대시보드 | organizations.vue, login-history.vue, tokens.vue, files.vue, dashboard.vue |

---

## 3. 주요 설계 결정 및 결과

### 3.1 AdminService — 기존 Repository DI 재사용

- **결정**: 새 엔티티/리포지토리 생성 없이 기존 패키지의 것을 DI 주입
- **결과**: 코드 중복 제로, 8개 도메인 데이터에 단일 서비스로 접근

### 3.2 로그인 이력 — $apiFetch 직접 사용

- **결정**: 페이지 전환 이벤트 핸들러에서는 `useApiFetch` 대신 `$apiFetch` 사용
- **결과**: Nuxt SSR 컨텍스트 제약 회피, 클라이언트 측 페이지네이션 정상 작동

### 3.3 Oracle nativeQuery — TRUNC 기반 일별 집계

- **결정**: JPQL 미지원 Oracle TRUNC 함수를 nativeQuery로 처리
- **결과**: 30일 일별 LOGIN_SUCCESS 건수 정확 집계, 대시보드 차트 데이터 제공

### 3.4 JWT 토큰 마스킹

- **결정**: 서버에서 앞 20자 + "..." 마스킹 후 `tokMasked` 필드 전달
- **결과**: 원본 토큰 클라이언트 노출 없이 관리자 확인 가능

---

## 4. Gap Analysis 결과

| Gap | 심각도 | 내용 | 처리 |
|-----|-------|------|------|
| G-1 | Important | layouts/admin.vue 대시보드 탭 누락 | ✅ 수정 완료 |
| G-2 | Minor | index.vue 리다이렉트 `/admin/codes` → `/admin/dashboard` 불일치 | ✅ 수정 완료 |

**최종 Match Rate: 100%**

---

## 5. Plan Success Criteria 최종 상태

| 성공 기준 | 최종 상태 |
|----------|----------|
| 9개 관리 화면 정상 라우팅 | ✅ Met |
| ITPAD001만 접근 가능 | ✅ Met |
| 공통코드 CRUD (인라인 편집) | ✅ Met |
| 자격등급·역할·사용자·조직 CRUD | ✅ Met |
| 로그인 이력 페이지네이션 | ✅ Met |
| JWT 토큰 마스킹 조회 | ✅ Met |
| 첨부파일 조회 | ✅ Met |
| 대시보드 차트 | ✅ Met |

**전체 성공 기준: 8/8 (100%)**

---

## 6. 학습 사항

1. **Nuxt `useFetch` vs `$fetch` 구분**: 이벤트 핸들러 내에서는 반드시 `$apiFetch` 사용 — `useApiFetch`는 setup 컨텍스트에서만 유효
2. **Oracle nativeQuery 반환 타입**: `Object[]`로 반환되므로 서비스 레이어에서 `(String) row[0]`, `((Number) row[1]).longValue()` 명시적 캐스팅 필요
3. **JPA Dirty Checking**: `update()` 메서드를 엔티티에 추가하면 `save()` 없이 `@Transactional` 내에서 자동 반영
4. **Gap 발생 패턴**: TabMenu 항목과 페이지 추가가 분리된 세션에서 진행될 때 동기화 누락 빈번 — 레이아웃 파일과 페이지 파일을 같은 세션에서 함께 확인할 것
