## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | admin-menu (관리자 메뉴 신설) |
| 작성일 | 2026-04-01 |
| 단계 | Plan |
| 의존성 | rbac (설계 진행 중 — ITPAD001 역할 보유자에게만 노출) |

### Value Delivered

| 관점 | 내용 |
|------|------|
| Problem | 시스템 운영에 필요한 공통코드·사용자·조직·역할 데이터를 DB 직접 접근 없이 관리할 방법이 없어 운영 효율이 낮음 |
| Solution | 시스템관리자(ITPAD001) 전용 [관리자] 메뉴를 상단 네비게이션에 추가하고, 9개 관리 화면(CRUD 5개 + 조회 3개 + 대시보드 1개)을 제공 |
| Function UX Effect | 인라인 편집·즉시 저장 방식으로 빠른 데이터 수정, Chart.js 대시보드로 접속자 현황 한눈에 파악, 이름 클릭 시 직원정보 팝업으로 사용자 확인 편의성 향상 |
| Core Value | 비개발자 관리자도 UI를 통해 시스템 데이터를 직접 관리하여 운영 자립도를 높이고 장애 대응 시간 단축 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | DB 직접 접근 없이 시스템 운영 데이터(공통코드·사용자·조직·역할)를 UI로 관리하기 위함 |
| WHO | 시스템관리자(ITPAD001 역할 보유자) — 3,000명 임직원 중 극소수 |
| RISK | rbac 미완성 시 관리자 메뉴 접근 제어 불가 / JWT 토큰 테이블명 PRD 오기 가능성 |
| SUCCESS | 9개 관리 화면 정상 작동 + ITPAD001만 메뉴 노출 + 인라인 편집 저장 성공 |
| SCOPE | 프론트(Nuxt 4 pages/admin/\*\*) + 백엔드(common/admin/\*\* API 9종) |

---

# admin-menu Plan — 관리자 메뉴 신설

## 1. 개요

### 1.1 배경 및 목적

현재 IT Portal 시스템은 공통코드·사용자·조직·역할 등 운영 데이터를 변경하려면 DB에 직접 접근해야 한다. 이는 운영 리스크와 장애 대응 시간을 증가시킨다.

PRD.md 요구사항에 따라 시스템관리자(ITPAD001) 전용 **[관리자] 메뉴**를 상단 네비게이션에 신설하고, 9개의 관리 화면을 제공한다. rbac 피처(현재 설계 진행 중)와 연동하여 권한 보유자에게만 메뉴를 노출한다.

### 1.2 관리자 메뉴 접근 제어

| 자격등급 | ATH_ID | 관리자 메뉴 노출 |
|---------|--------|----------------|
| 일반사용자 | ITPZZ001 | 미노출 |
| 기획통할담당자 | ITPZZ002 | 미노출 |
| 시스템관리자 | ITPAD001 | **노출** |

> rbac 피처에서 JWT 클레임에 ATH_ID를 포함시키면, 프론트에서 `authStore.user.athId === 'ITPAD001'` 조건으로 메뉴 노출 여부를 제어한다.

### 1.3 9개 하위 기능 목록

| # | 기능명 | 테이블 | 타입 | 경로 |
|---|-------|--------|------|------|
| 1 | 공통코드 관리 | TAAABB_CCODEM | CRUD | /admin/codes |
| 2 | 자격등급 관리 | TAAABB_CAUTHI | CRUD | /admin/auth-grades |
| 3 | 사용자 관리 | TAAABB_CUSERI | CRUD | /admin/users |
| 4 | 조직 관리 | TAAABB_CORGNI | CRUD | /admin/organizations |
| 5 | 역할 관리 | TAAABB_CROLEI | CRUD | /admin/roles |
| 6 | 로그인 이력 | TAAABB_CLOGNH | 조회 | /admin/login-history |
| 7 | JWT 토큰 조회 | TAAABB_CRTOKM ※ | 조회 | /admin/tokens |
| 8 | 첨부파일 조회 | TAAABB_CFILEM | 조회 | /admin/files |
| 9 | 대시보드 | (통계 집계) | Chart.js | /admin/dashboard |

> ※ PRD에는 JWT 토큰 테이블을 `TAAABB_CLOGNH`로 기재했으나, 백엔드 CLAUDE.md 기준 Refresh Token 테이블은 **`TAAABB_CRTOKM`**(`Crtokm` 엔티티)이다. 구현 시 `TAAABB_CRTOKM`을 사용한다.

---

## 2. 요구사항

### 2.1 공통 요구사항

| # | 요구사항 | 우선순위 |
|---|---------|---------|
| C-01 | 상단 메뉴바에 [관리자] 메뉴 추가 (노란색 왕관 SVG 아이콘) | 필수 |
| C-02 | [관리자] 메뉴 클릭 시 /admin/dashboard로 이동 | 필수 |
| C-03 | ITPAD001 역할 보유자에게만 [관리자] 메뉴 표시 (rbac 연동) | 필수 |
| C-04 | GUID, GUID_PRG_SNO 컬럼은 화면에 표시하지 않음 | 필수 |
| C-05 | ENO(사원번호), FST_ENR_USID(최초생성자), LST_CHG_USID(마지막수정자)는 이름으로 표기 | 필수 |
| C-06 | 이름 클릭 시 직원정보 다이얼로그 팝업 (공통 컴포넌트 `EmployeeDialog` 사용) | 필수 |
| C-07 | 인라인 편집 저장: 행 단위 즉시 저장 (변경 후 포커스 이탈 또는 Enter 시 API 호출) | 필수 |
| C-08 | 삭제는 Soft Delete (DEL_YN='Y') — 물리 삭제 금지 | 필수 |

### 2.2 기능별 요구사항

#### 공통코드 관리 (TAAABB_CCODEM)
- 조회: 전체 코드 목록 (사용자·조직 join → 생성자/수정자 이름 표시)
- 추가: 신규 코드 행 삽입
- 수정: 인라인 편집 (C_NM, CDVA, C_DES, CTT_TP, CTT_TP_DES, STT_DT, END_DT, C_SQN)
- 삭제: DEL_YN='Y' (Soft Delete)
- 표시 컬럼: C_ID, C_NM, CDVA, C_DES, CTT_TP, CTT_TP_DES, STT_DT, END_DT, C_SQN, FST_ENR_DTM, FST_ENR_USID(이름), LST_CHG_DTM, LST_CHG_USID(이름)

#### 자격등급 관리 (TAAABB_CAUTHI)
- 조회: 전체 자격등급 목록 (사용자·조직 join)
- 추가/수정(인라인)/삭제
- 표시 컬럼: ATH_ID, QLF_GR_NM, QLF_GR_MAT, USE_YN, FST_ENR_DTM, FST_ENR_USID(이름), LST_CHG_DTM, LST_CHG_USID(이름)

#### 사용자 관리 (TAAABB_CUSERI)
- 조회: 조직 join → 소속팀, 소속부서 포함
- 추가/수정(인라인)/삭제
- 표시 컬럼: ENO(이름), USR_NM, PT_C_NM, TEM_NM, BBR_NM(부서), ETR_MIL_ADDR_NM, INLE_NO, CPN_TPN, FST_ENR_DTM, LST_CHG_DTM
- ENO 클릭 → 직원정보 팝업

#### 조직 관리 (TAAABB_CORGNI)
- 조회: 사용자·조직 join
- 추가/수정(인라인)/삭제
- 표시 컬럼: PRLM_OGZ_C_CONE, BBR_NM, BBR_WREN_NM, ITM_SQN_SNO, PRLM_HRK_OGZ_C_CONE, FST_ENR_DTM, FST_ENR_USID(이름), LST_CHG_DTM, LST_CHG_USID(이름)

#### 역할 관리 (TAAABB_CROLEI)
- 조회: 사용자·조직 join
- 추가/수정(인라인)/삭제
- 표시 컬럼: ATH_ID, ENO(이름), USE_YN, FST_ENR_DTM, FST_ENR_USID(이름), LST_CHG_DTM, LST_CHG_USID(이름)

#### 로그인 이력 (TAAABB_CLOGNH) — 조회 전용
- 표시 컬럼: ENO(이름), LGN_DTM, LGN_TP, IP_ADDR, FLUR_RSN, UST_AGT, FST_ENR_DTM
- 정렬: LGN_DTM DESC
- 페이지네이션 필수 (데이터 다량)

#### JWT 토큰 조회 (TAAABB_CRTOKM) — 조회 전용
- 표시 컬럼: ENO(이름), END_DTM, TOK(일부만 표시 마스킹), FST_ENR_DTM
- 정렬: FST_ENR_DTM DESC

#### 첨부파일 조회 (TAAABB_CFILEM) — 조회 전용
- 표시 컬럼: FL_MNG_NO, ORC_FL_NM, FL_DTT, ORC_DTT, FST_ENR_DTM, FST_ENR_USID(이름), LST_CHG_DTM

#### 대시보드 (Chart.js)
- 접속자 수 추이: TAAABB_CLOGNH에서 일별/시간별 로그인 건수 집계
- 서버 자원 사용량: 미정 (향후 별도 API 또는 정적 데이터로 대체 가능)
- PrimeVue `<Chart>` 컴포넌트 활용 (내부적으로 Chart.js 사용)
- 대시보드를 /admin 진입점으로 사용

---

## 3. 기술 설계 방향

### 3.1 프론트엔드 구조 (Nuxt 4)

```
app/
├── pages/
│   └── admin/
│       ├── dashboard.vue          ← 대시보드 (진입점)
│       ├── codes.vue              ← 공통코드 관리
│       ├── auth-grades.vue        ← 자격등급 관리
│       ├── users.vue              ← 사용자 관리
│       ├── organizations.vue      ← 조직 관리
│       ├── roles.vue              ← 역할 관리
│       ├── login-history.vue      ← 로그인 이력
│       ├── tokens.vue             ← JWT 토큰 조회
│       └── files.vue              ← 첨부파일 조회
├── layouts/
│   └── admin.vue                  ← 관리자 레이아웃 (사이드바 포함)
├── middleware/
│   └── admin.ts                   ← 관리자 권한 체크 미들웨어
└── composables/
    └── useAdminApi.ts             ← 관리자 API 공통 composable
```

### 3.2 백엔드 구조 (Spring Boot)

```
src/main/java/com/kdb/it/
└── common/
    └── admin/
        ├── controller/
        │   └── AdminController.java      ← 9개 기능 API
        ├── service/
        │   └── AdminService.java
        ├── repository/
        │   ├── AdminRepository.java      ← JpaRepository
        │   └── AdminRepositoryImpl.java  ← QueryDSL (join 쿼리)
        └── dto/
            └── AdminDto.java             ← Static Nested Class 방식
```

### 3.3 API 엔드포인트 설계 (안)

| Method | Path | 기능 |
|--------|------|------|
| GET | /api/admin/codes | 공통코드 목록 |
| POST | /api/admin/codes | 공통코드 추가 |
| PUT | /api/admin/codes/{cId} | 공통코드 수정 |
| DELETE | /api/admin/codes/{cId} | 공통코드 삭제 |
| GET | /api/admin/auth-grades | 자격등급 목록 |
| POST | /api/admin/auth-grades | 자격등급 추가 |
| PUT | /api/admin/auth-grades/{athId} | 자격등급 수정 |
| DELETE | /api/admin/auth-grades/{athId} | 자격등급 삭제 |
| GET | /api/admin/users | 사용자 목록 |
| POST | /api/admin/users | 사용자 추가 |
| PUT | /api/admin/users/{eno} | 사용자 수정 |
| DELETE | /api/admin/users/{eno} | 사용자 삭제 |
| GET | /api/admin/organizations | 조직 목록 |
| POST | /api/admin/organizations | 조직 추가 |
| PUT | /api/admin/organizations/{orgC} | 조직 수정 |
| DELETE | /api/admin/organizations/{orgC} | 조직 삭제 |
| GET | /api/admin/roles | 역할 목록 |
| POST | /api/admin/roles | 역할 추가 |
| PUT | /api/admin/roles/{athId}/{eno} | 역할 수정 |
| DELETE | /api/admin/roles/{athId}/{eno} | 역할 삭제 |
| GET | /api/admin/login-history | 로그인 이력 (페이지네이션) |
| GET | /api/admin/tokens | JWT 토큰 목록 |
| GET | /api/admin/files | 첨부파일 목록 |
| GET | /api/admin/dashboard/login-stats | 대시보드 접속자 통계 |

> 모든 /api/admin/** 경로는 Spring Security에서 ITPAD001 역할 보유자만 접근 가능하도록 설정

### 3.4 공통 처리

**이름 표기 (ENO → 사용자명)**
- 백엔드: QueryDSL에서 `CuserI` 테이블 join → `usrNm` 필드 포함하여 반환
- 프론트: 별도 변환 불필요, API 응답에 이름 필드 포함

**직원정보 팝업**
- 기존 공통 컴포넌트 `EmployeeDialog` (또는 유사 컴포넌트) 재사용
- 없으면 신규 생성: `components/common/EmployeeDialog.vue`

**인라인 편집 저장**
- PrimeVue `DataTable` + `Column`의 `editable` 모드 활용
- 행 편집 완료 시(`@row-edit-save`) 즉시 PUT API 호출

---

## 4. 리스크 및 제약사항

| 리스크 | 영향 | 대응 방안 |
|--------|------|---------|
| rbac 피처 미완성 | 관리자 메뉴 접근 제어 불가 | rbac Design 완료 후 admin-menu Do 시작. 개발 순서: rbac → admin-menu |
| PRD JWT 테이블 오기 | TAAABB_CLOGNH ≠ JWT 토큰 테이블 | `TAAABB_CRTOKM` 사용 확정 (백엔드 CLAUDE.md 기준) |
| 서버 자원 사용량 수집 미정 | 대시보드 일부 위젯 미구현 | 1차에서는 로그인 통계만 구현, 서버 자원은 Mock 또는 차기 반영 |
| 인라인 편집 동시성 | 다중 관리자 동시 편집 시 충돌 | 단일 관리자 운영 전제 (낙관적 잠금은 추후 검토) |
| 사용자 관리 비밀번호 처리 | 사용자 추가 시 초기 비밀번호 | SHA-256 + Base64 인코딩 (CustomPasswordEncoder 활용) |

---

## 5. 구현 순서 (권장)

```
1. 백엔드 공통 구조 (AdminController, AdminService, AdminDto)
2. 공통코드 관리 API + 프론트 (가장 단순한 테이블)
3. 자격등급 관리 API + 프론트
4. 역할 관리 API + 프론트
5. 사용자 관리 API + 프론트 (join 복잡)
6. 조직 관리 API + 프론트
7. 로그인 이력 / JWT 토큰 / 첨부파일 조회 (read-only, 단순)
8. 대시보드 (Chart.js 통계)
9. 상단 메뉴바 [관리자] 추가 + admin 미들웨어 + 레이아웃
```

---

## 6. 성공 기준

| 기준 | 검증 방법 |
|------|---------|
| ITPAD001 사용자만 [관리자] 메뉴 표시 | 일반사용자 로그인 시 메뉴 미노출 확인 |
| 공통코드 인라인 편집 후 즉시 DB 반영 | 편집 후 새로고침 시 변경값 유지 |
| 삭제 시 DEL_YN='Y' 처리 (물리 삭제 금지) | DB 직접 조회로 확인 |
| 이름 클릭 시 직원정보 팝업 정상 표시 | 모든 관리 화면에서 검증 |
| 대시보드 접속자 수 차트 렌더링 | 로그인 이력 데이터 기반 시각화 확인 |
| 비인가 접근 시 403 응답 | curl로 일반 토큰으로 /api/admin/** 호출 |
