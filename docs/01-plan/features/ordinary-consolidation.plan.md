# Plan: 경상사업/정보화사업 화면 통합 (ordinary-consolidation)

> **Created**: 2026-04-05
> **Feature**: ordinary-consolidation
> **Status**: Draft

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 경상사업(ordinary)과 정보화사업(projects)이 거의 동일한 데이터 모델을 공유하면서도 6개 파일이 분리되어 있어, 기능 변경 시 양쪽을 모두 수정해야 하는 이중 유지보수 부담 발생 |
| **Solution** | `ornYn` 플래그 기반 조건부 렌더링으로 `projects/` 하위 3개 파일(index, [id], form)에 통합. `ordinary/` 디렉토리 완전 제거 |
| **Function UX Effect** | 목록에서 구분 필터로 정보화사업/경상사업 전환, 상세/폼에서 경상사업 비해당 섹션 자동 숨김 |
| **Core Value** | 코드 중복 60% 이상 제거, 단일 진실 원천(Single Source of Truth) 확보, 향후 기능 변경 시 수정 지점 절반으로 감소 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 경상/정보화 분리 구조로 인한 이중 유지보수 비용 제거 |
| **WHO** | 정보기술부문 약 3,000명 사내 임직원 (사업 등록·조회 사용자) |
| **RISK** | 기존 budget 페이지들의 `_link` 경로 변경 누락, 폼 저장 시 ornYn 플래그 누락 |
| **SUCCESS** | ordinary/ 디렉토리 완전 제거, 모든 경상사업 CRUD가 projects/ 경로에서 정상 동작 |
| **SCOPE** | 프론트엔드 only (백엔드 API 변경 없음). index.vue, [id].vue, form.vue 3개 파일 수정 + ordinary/ 3개 파일 삭제 |

---

## 1. 요구사항

### 1.1 핵심 요구사항

1. **목록 통합**: `projects/index.vue`에서 정보화사업(`ornYn='N'`)과 경상사업(`ornYn='Y'`)을 하나의 DataTable에 표시하고, 구분 컬럼 + 필터로 전환
2. **상세 통합**: `projects/[id].vue`에서 `ornYn` 기반으로 경상사업 비해당 섹션(사업범위, 진행상황, 사업구분, 편성기준, 담당조직, 보고상태)을 `v-if`로 숨김
3. **폼 통합**: `projects/form.vue`에서 `ornYn` 기반으로 경상사업 비해당 필드/섹션을 `v-if`로 숨기고, 저장 시 `ornYn` 값 자동 결정
4. **디렉토리 제거**: `ordinary/` 디렉토리(index.vue, [id].vue, form.vue) 완전 삭제
5. **링크 수정**: budget 페이지들(approval, list, work)의 `_link` 경로에서 `/info/projects/ordinary/` 참조 모두 제거

### 1.2 비기능 요구사항

- 백엔드 API 변경 없음 (프론트엔드 only)
- 기존 정보화사업 기능에 영향 없음 (regression 방지)
- URL 체계: `/info/projects/:id`로 통일 (경상사업도 동일 경로)

## 2. 현재 구조 분석

### 2.1 분리된 파일 매핑

| 정보화사업 (projects/) | 경상사업 (ordinary/) | 차이점 |
|------------------------|----------------------|--------|
| `index.vue` (254행) | `index.vue` (253행) | 필터: ornYn='N' vs 'Y', 컬럼 거의 동일 |
| `[id].vue` (~1100행) | `[id].vue` (400행) | 9개 섹션 vs 4개 섹션 (5개 섹션 미표시) |
| `form.vue` (~750행) | `form.vue` (~280행) | 9개 섹션 vs 4개 섹션, 필드 대폭 축소 |

### 2.2 경상사업에서 숨겨야 할 섹션/필드

**상세 페이지 ([id].vue)**:
| 섹션 | 정보화사업 | 경상사업 | 처리 |
|------|:----------:|:--------:|------|
| 1. 사업 진행 현황 | O | O | 표시 |
| 2. 사업 개요 (prjDes + 현황/필요성) | O | O | 표시 (기대효과/미추진시문제점만 숨김) |
| 3. 사업 범위 및 일정 | O | X | `v-if="!isOrdinary"` |
| 4. 사업 구분 | O | X | `v-if="!isOrdinary"` |
| 5. 편성 기준 | O | X | `v-if="!isOrdinary"` |
| 6. 담당 조직 | O | X | `v-if="!isOrdinary"` |
| 7. 추진시기 및 소요예산 | O | O | 표시 (보고상태 카드만 숨김) |
| 8. 소요자원 상세 | O | O | 표시 |
| TOC 사이드바 | O | O | 표시 (숨긴 섹션 항목 자동 제외) |

**폼 페이지 (form.vue)**:
| 섹션 | 정보화사업 | 경상사업 | 처리 |
|------|:----------:|:--------:|------|
| 기본정보 (사업명, 유형, 연도) | O | O | 표시 |
| 사업 개요 (RichText + 현황/필요성) | O | O | 표시 (기대효과/미추진시문제점만 숨김) |
| 사업 범위 (RichText) | O | X | `v-if="!isOrdinary"` |
| 진행 상황 (추진경과/향후계획) | O | X | `v-if="!isOrdinary"` |
| 사업 구분 | O | X | `v-if="!isOrdinary"` |
| 편성 기준 | O | X | `v-if="!isOrdinary"` |
| 담당부서 | O | X | `v-if="!isOrdinary"` |
| 추진시기 및 소요예산 | O | O (일부) | 보고상태/시작일/종료일/추진가능성 숨김 |
| 소요자원 상세 | O | O | 표시 |

## 3. 구현 계획

### 3.1 isOrdinary 판별 로직

```typescript
// 목록 페이지: ornYn 필드로 판별
const isOrdinary = (project: Project) => (project as any).ornYn === 'Y';

// 상세/폼 페이지: 수정 모드에서는 API 응답의 ornYn, 신규 등록은 쿼리 파라미터
const isOrdinary = computed(() => {
  // 수정 모드: 조회된 데이터의 ornYn
  if (isEditMode.value && project.value) return (project.value as any).ornYn === 'Y';
  // 신규 등록: ?ordinary=true 쿼리 파라미터
  return route.query.ordinary === 'true';
});
```

### 3.2 수정 대상 파일

| 파일 | 작업 | 설명 |
|------|------|------|
| `projects/index.vue` | **수정** | ornYn 필터 제거, 전체 조회 + 구분 컬럼/필터 추가 |
| `projects/[id].vue` | **수정** | isOrdinary computed 추가, 5개 섹션 v-if 처리, TOC 동적 필터링 |
| `projects/form.vue` | **수정** | isOrdinary computed 추가, 섹션/필드 v-if 처리, 저장 시 ornYn 설정 |
| `budget/approval.vue` | **수정** | `_link` 경로 통일 (`/info/projects/${id}`) |
| `budget/list.vue` | **수정** | `_link` 경로 통일 |
| `budget/work.vue` | **수정** | `_link` 경로 통일 |
| `ordinary/index.vue` | **삭제** | 통합 완료 후 제거 |
| `ordinary/[id].vue` | **삭제** | 통합 완료 후 제거 |
| `ordinary/form.vue` | **삭제** | 통합 완료 후 제거 |

### 3.3 구현 순서

1. **Phase 1 — 상세 페이지 통합** (`[id].vue`)
   - `isOrdinary` computed 추가
   - 5개 섹션에 `v-if="!isOrdinary"` 적용
   - 사업 개요 섹션: 기대효과/미추진시문제점 `v-if="!isOrdinary"`
   - 소요예산 섹션: 보고상태 카드 `v-if="!isOrdinary"`
   - TOC 항목 동적 필터링 (isOrdinary일 때 해당 섹션 제외)
   - 헤더에 경상사업 태그 표시 조건 추가

2. **Phase 2 — 폼 페이지 통합** (`form.vue`)
   - `isOrdinary` computed 추가 (쿼리 파라미터 or 기존 데이터 기반)
   - 5개 섹션에 `v-if="!isOrdinary"` 적용
   - 저장 시 `ornYn` 값 자동 설정 (isOrdinary ? 'Y' : 'N')
   - 페이지 타이틀 동적 변경 ('경상사업 예산 작성' / '정보화사업 예산 작성')

3. **Phase 3 — 목록 페이지 통합** (`index.vue`)
   - `ornYn` 필터 제거하여 전체 조회
   - '구분' 컬럼 추가 (경상/사업 Tag)
   - 조회 Drawer에 구분 필터 추가
   - 신규 등록 버튼 분기: 경상사업 등록 시 `?ordinary=true` 전달
   - 사업명 클릭 링크 통일: `/info/projects/${prjMngNo}`

4. **Phase 4 — 링크 수정 + 정리**
   - `budget/approval.vue`, `budget/list.vue`, `budget/work.vue`의 `_link` 통일
   - `ordinary/` 디렉토리 3개 파일 삭제
   - 전체 codebase에서 `/ordinary/` 경로 참조 정리

## 4. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 폼 저장 시 ornYn 누락 | 경상사업이 일반으로 잘못 저장 | isOrdinary 기반 자동 설정 + 필수값 검증 |
| 기존 budget 링크 누락 | 경상사업 클릭 시 404 | 전체 codebase grep으로 `/ordinary/` 참조 일괄 점검 |
| 조건부 렌더링으로 코드 복잡도 증가 | 유지보수 부담 | 섹션 단위 v-if (블록 단위), 인라인 조건 최소화 |
| 신규 등록 시 경상/일반 구분 혼동 | 사용자 혼란 | 신규 등록 버튼 2개 제공 (일반사업 / 경상사업) |

## 5. 성공 기준

- [ ] `ordinary/` 디렉토리 완전 제거 (3개 파일)
- [ ] `/info/projects` 목록에서 정보화사업 + 경상사업 통합 표시
- [ ] `/info/projects/:id` 상세에서 경상사업 조회 시 비해당 섹션 자동 숨김
- [ ] `/info/projects/form` 에서 경상사업 등록/수정 정상 동작 (ornYn='Y' 자동 설정)
- [ ] `budget/` 페이지에서 경상사업 클릭 시 정상 이동
- [ ] 기존 정보화사업 기능 regression 없음
