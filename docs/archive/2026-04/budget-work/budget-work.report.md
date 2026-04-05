# budget-work 완료 보고서 — 예산 작업 화면 및 기능

> **작성일**: 2026-04-05
> **Feature**: budget-work
> **Match Rate**: ~100% (수정 후)
> **Phase**: completed

---

## Executive Summary

| 관점 | 계획 | 실제 결과 |
|------|------|----------|
| Problem | 결재완료 예산에 비목별 편성률을 적용하는 기능 부재, 수작업 편성 | 동일한 문제 해결. CCODEM(DUP_IOE) 기반 편성비목별 편성률 입력 → 일괄 저장 기능 구현 완료 |
| Solution | 예산 작업 화면 신설 + API 3종 + BBUGTM 신규 테이블 | 계획대로 구현. 백엔드 8파일(entity/repository/service/controller) + 프론트엔드 2파일(types/page) |
| Function UX Effect | 한 화면에서 편성률 입력 → 저장 → 결과 테이블 확인 | 연도 선택 + InputNumber 편성률 입력 + 저장 → 합계 포함 결과 DataTable 표시. GET /summary 별도 호출 제거로 네트워크 최적화 |
| Core Value | 예산 편성 프로세스 시스템화, 수작업 오류 제거 | 결재완료 건만 필터링(CAPPLA+CAPPLM 서브쿼리) + Upsert로 중복 방지. 편성금액 자동 계산(HALF_UP) |

---

## 1. 구현 개요

### 1.1 배경

IT Portal 시스템에서 정보화사업(BPROJM)·전산업무비(BCOSTM) 결재완료 예산에 대해 비목별 편성률을 적용하여 최종 편성예산(BBUGTM)을 산출하는 기능이 없었다. 예산 담당자가 수작업으로 편성 작업을 진행해야 하는 문제를 시스템화하기 위해 본 기능을 구현하였다.

### 1.2 구현 범위

| 구분 | 파일 | 역할 |
|------|------|------|
| Backend Entity | `Bbugtm.java` | TAAABB_BBUGTM 엔티티 (BaseEntity 상속, 복합키) |
| Backend Entity | `BbugtmId.java` | 복합키 클래스 (BG_MNG_NO + BG_SNO) |
| Backend Repository | `BbugtmRepository.java` | JpaRepository + 시퀀스 채번 + Upsert 조회 |
| Backend Repository | `BbugtmRepositoryCustom.java` | QueryDSL 인터페이스 |
| Backend Repository | `BbugtmRepositoryImpl.java` | 결재완료 필터 + 비목 접두어 매칭 QueryDSL |
| Backend DTO | `BudgetWorkDto.java` | Java record 7개 (ApplyRequest, RateItem, IoeCategoryResponse, SummaryResponse, SummaryItem, SummaryTotals, ApplyResponse) |
| Backend Service | `BudgetWorkService.java` | 비즈니스 로직 3메서드 |
| Backend Controller | `BudgetWorkController.java` | REST 엔드포인트 3종 |
| Frontend Types | `app/types/budget-work.ts` | TypeScript 인터페이스 4개 |
| Frontend Page | `app/pages/budget/work.vue` | 예산 작업 메인 페이지 |

**총 10파일 신규 생성** (기존 파일 수정 없음)

---

## 2. 아키텍처 결정 사항

### 2.1 Decision Record Chain

| 단계 | 결정 | 근거 |
|------|------|------|
| Plan | 결재완료 필터: CAPPLA+CAPPLM 최신 신청서 MAX 서브쿼리 | 기존 CostRepositoryImpl/ProjectRepositoryImpl 패턴 재사용 |
| Plan | BITEMM 매칭: GCL_DTT 컬럼 기반 접두어 매칭 | BITEMM에 IOE_C 없음 → GCL_DTT(품목구분) 활용 |
| Design | Option C — Pragmatic Balance | 단일 Service + QueryDSL Custom Repository. 과도한 추상화 없이 기존 패턴 재사용 |
| Design | DTO: Java record 타입 | AdminDto 등 기존 코드에서도 record 사용 중. 불변성 + 간결성 |
| Do | Upsert 키: (BG_YY, ORC_TB, ORC_PK_VL, ORC_SNO_VL, IOE_C, DEL_YN='N') | 동일 원본 레코드에 대한 중복 저장 방지 |
| Do | ORC_TB = "BITEMM" | BITEMM 자체 PK(GCL_MNG_NO+GCL_SNO) 보유. 개별 품목 단위 추적 가능 |
| Check | GET /summary 별도 호출 생략 | POST /apply 응답에 summary 포함 → 네트워크 최적화 |

### 2.2 핵심 알고리즘

**편성률 매칭 로직**:
```
cdId = "DUP-IOE-237"
prefix = cdId.replace("DUP-IOE-", "")  → "237"

findApprovedCostsByPrefix("237")
  → BCOSTM WHERE IOE_C LIKE '237%' AND 결재완료

findApprovedItemsByPrefix("237")
  → BITEMM WHERE GCL_DTT LIKE '237%' AND BPROJM 결재완료
```

**편성금액 계산**:
```java
dupBg = requestAmount
    .multiply(BigDecimal.valueOf(dupRt))
    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
```

**Upsert 패턴**:
```java
Optional<Bbugtm> existing = bbugtmRepository.findBy...(bgYy, orcTb, pkVl, snoVl, ioeC, "N")
if (existing.isPresent()) {
    existing.get().update(dupBg, dupRt)  // JPA Dirty Checking
} else {
    bbugtmRepository.save(new Bbugtm(...))
}
```

---

## 3. API 구현 결과

| API | 경로 | 구현 결과 |
|-----|------|---------|
| API-01 | GET /api/budget/work/ioe-categories | ✅ CCODEM DUP_IOE 조회 + 기존 편성률 + 요청금액 합계 반환 |
| API-02 | POST /api/budget/work/apply | ✅ @Transactional, BCOSTM/BITEMM 결재완료 필터, Upsert, 결과 요약 반환 |
| API-03 | GET /api/budget/work/summary | ✅ BBUGTM 연도별 조회 + 접두어 그룹핑 + 합계 집계 |

---

## 4. 성공 기준 달성 현황

| # | 기준 | 상태 | 근거 |
|---|------|------|------|
| SC-01 | 편성비목 목록이 CCODEM(DUP_IOE) 기준으로 정확히 표시 | ✅ Met | `findByCttTpWithValidDate("DUP_IOE", null)` |
| SC-02 | 편성률 저장 시 결재완료 건만 대상으로 BBUGTM 레코드 생성 | ✅ Met | BbugtmRepositoryImpl CAPPLA+CAPPLM MAX 서브쿼리 |
| SC-03 | 편성금액 = 요청금액 × (편성률/100) 계산 정확성 | ✅ Met | BigDecimal HALF_UP 2자리 |
| SC-04 | 편성 결과 테이블에서 비목별 합계가 정확히 표시 | ✅ Met | SummaryTotals + DataTable footer |
| SC-05 | 기존 편성 데이터 재저장 시 UPDATE (중복 INSERT 방지) | ✅ Met | Dirty Checking + 5-key Upsert 조회 |

**SC 달성률: 5/5 (100%)**

---

## 5. Check Phase 결과

| 분석 축 | Match Rate |
|--------|-----------|
| Structural | 100% (10/10 파일) |
| Functional | 95% → 수정 후 100% |
| API Contract | 97% → 수정 후 100% |
| **Overall** | **~100%** |

### 5.1 발견 및 수정된 이슈

| # | 이슈 | 심각도 | 조치 |
|---|------|--------|------|
| 1 | `extractPrefix` 방식이 Design §6.1과 표현 다름 | Minor | `replace("DUP-IOE-", "")` 방식으로 수정 |
| 2 | ORC_TB="BITEMM" 사용 (Plan 문서는 "BPROJM" 표기) | Minor | 더 정확한 구현 유지 + 설명 주석 추가 |
| 3 | GET /summary 별도 호출 없이 POST 응답 재사용 | Minor | 최적화 의도 주석 명시 |

---

## 6. 기술적 특이사항

### 6.1 재사용된 기존 패턴

- **CAPPLA+CAPPLM 결재완료 서브쿼리**: `CostRepositoryImpl`, `ProjectRepositoryImpl`과 동일한 패턴을 `BbugtmRepositoryImpl`에서 재사용
- **BaseEntity 상속**: DEL_YN, GUID, 감사 필드 자동 관리
- **@IdClass 복합키**: `BprojmId`, `BcostmId`와 동일한 패턴
- **Java record DTO**: `AdminDto` 등 기존 코드와 일관된 패턴

### 6.2 프론트엔드 최적화

- POST /apply 응답 내 `summary` 필드를 직접 활용하여 별도 GET /summary 호출 제거
- `useApiFetch`의 reactive query로 연도 변경 시 자동 재조회
- `rateMap`으로 편성률 로컬 상태 관리, 기존 편성률 자동 로드

### 6.3 남은 개선 사항 (향후 고려)

| 항목 | 우선순위 | 설명 |
|------|---------|------|
| Oracle S_BG 시퀀스 생성 | 필수 (배포 전) | DB에 `CREATE SEQUENCE S_BG` 실행 필요 |
| TAAABB_BBUGTM 테이블 생성 | 필수 (배포 전) | DDL 스크립트 실행 필요 |
| 페이지 초기 로드 시 이전 편성 결과 표시 | 선택 | 현재는 저장 후에만 결과 테이블 표시 |
| 편성률 0~100 외 입력 방지 서버사이드 검증 | 선택 | 현재 프론트엔드 InputNumber min/max로만 제한 |

---

## 7. PDCA 사이클 요약

| Phase | 소요 내용 | 결과 |
|-------|---------|------|
| Plan | PRD 기반 요구사항 확정, API 3종 설계, Upsert 전략 결정 | budget-work.plan.md |
| Design | Option C 선택, Session Guide 3모듈 분리, QueryDSL 패턴 설계 | budget-work.design.md |
| Do (module-1) | Entity + Repository 5파일 구현 | BUILD SUCCESS |
| Do (module-2) | DTO + Service + Controller 3파일 구현 | BUILD SUCCESS |
| Do (module-3) | Frontend Types + Page 2파일 구현 | BUILD SUCCESS |
| Check | Match Rate 97% → Minor 3건 수정 → ~100% | 이슈 없음 |
| Report | 완료 | 본 문서 |
