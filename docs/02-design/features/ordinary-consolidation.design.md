# Design: 경상사업/정보화사업 화면 통합 (ordinary-consolidation)

> **Created**: 2026-04-05
> **Feature**: ordinary-consolidation
> **Architecture**: Option A — Inline v-if
> **Status**: Draft

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 경상/정보화 분리 구조로 인한 이중 유지보수 비용 제거 |
| **WHO** | 정보기술부문 약 3,000명 사내 임직원 |
| **RISK** | budget 페이지 `_link` 경로 변경 누락, 폼 저장 시 ornYn 플래그 누락 |
| **SUCCESS** | ordinary/ 디렉토리 완전 제거, 모든 경상사업 CRUD가 projects/ 경로에서 정상 동작 |
| **SCOPE** | 프론트엔드 only. index/[id]/form 3개 파일 수정 + ordinary/ 3개 파일 삭제 |

---

## 1. Overview

기존 `pages/info/projects/ordinary/` 디렉토리의 3개 파일(index, [id], form)을 `pages/info/projects/`의 동일 파일에 `isOrdinary` 기반 조건부 렌더링으로 통합합니다.

**선택된 아키텍처**: Inline v-if 방식
- 기존 페이지에 `isOrdinary` computed 추가
- 섹션/필드 단위 `v-if="!isOrdinary"` 적용
- 추가 파일 생성 없음

## 2. Data Model

백엔드 API 변경 없음. 기존 Project 모델의 `ornYn` 필드를 활용합니다.

```typescript
// 기존 Project 타입에 ornYn이 이미 존재 (any 캐스팅으로 접근 중)
interface Project {
  prjMngNo: string;
  ornYn?: 'Y' | 'N';  // 경상사업 여부
  // ... 기존 필드
}
```

## 3. Page-Level Design

### 3.1 상세 페이지 (`pages/info/projects/[id].vue`)

#### isOrdinary 판별

```typescript
/** 경상사업 여부 (ornYn='Y') */
const isOrdinary = computed(() => (project.value as any)?.ornYn === 'Y');
```

#### 페이지 타이틀 동적 변경

```typescript
const pageTitle = computed(() => isOrdinary.value ? '경상사업 상세' : '정보화사업 상세');
```

#### 헤더 태그 조건

```html
<!-- 경상사업일 때만 "경상사업" 태그 표시 -->
<Tag v-if="isOrdinary" value="경상사업"
    class="bg-amber-50 text-amber-600 ..." rounded />
```

#### 섹션별 v-if 매핑

| 섹션 ID | 섹션명 | v-if 조건 |
|---------|--------|-----------|
| `section-progress` | 사업 진행 현황 | 항상 표시 |
| `section-overview` | 사업 개요 | 항상 표시 |
| `sub-overview-expect` | 기대효과 | `v-if="!isOrdinary"` |
| `sub-overview-problem` | 미추진 시 문제점 | `v-if="!isOrdinary"` |
| `section-scope` | 사업 범위 및 일정 | `v-if="!isOrdinary"` |
| `section-category` | 사업 구분 | `v-if="!isOrdinary"` |
| `section-criteria` | 편성 기준 | `v-if="!isOrdinary"` |
| `section-org` | 담당 조직 | `v-if="!isOrdinary"` |
| `section-budget` | 소요예산 | 항상 표시 |
| `sub-budget-report` | 보고상태 카드 | `v-if="!isOrdinary"` |
| `section-resource` | 소요자원 상세 | 항상 표시 |

#### 소요예산 카드 그리드 동적 변경

```html
<!-- 정보화사업: 3열 (총예산/전결권/보고상태), 경상사업: 2열 (총예산/전결권) -->
<div :class="isOrdinary ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'" class="grid gap-4">
```

#### TOC 동적 필터링

```typescript
/** 경상사업 시 숨길 섹션 ID Set */
const hiddenSectionIds = computed(() => {
    if (!isOrdinary.value) return new Set<string>();
    return new Set([
        'section-scope', 'section-category', 'section-criteria', 'section-org',
        'sub-overview-expect', 'sub-overview-problem', 'sub-budget-report'
    ]);
});

/** 화면에 표시할 TOC 항목 (경상사업 시 해당 섹션 제외) */
const filteredTocItems = computed(() => {
    return tocItems
        .filter(item => !hiddenSectionIds.value.has(item.id))
        .map(item => ({
            ...item,
            children: item.children?.filter(c => !hiddenSectionIds.value.has(c.id))
        }))
        .filter(item => !item.children || item.children.length > 0);
});
```

#### IntersectionObserver 동적 대응

```typescript
// onMounted에서 filteredTocItems 기반으로 observe 대상 설정
// isOrdinary로 숨겨진 섹션은 DOM에 존재하지 않으므로 자연스럽게 제외됨
```

#### 수정 버튼 라우팅

```html
<!-- 경상사업: ?ordinary=true 추가, 일반: 기존 경로 -->
<Button label="수정" icon="pi pi-pencil"
    @click="navigateTo(`/info/projects/form?id=${project.prjMngNo}${isOrdinary ? '&ordinary=true' : ''}`)" />
```

### 3.2 폼 페이지 (`pages/info/projects/form.vue`)

#### isOrdinary 판별

```typescript
/** 경상사업 여부: 수정 모드에서는 기존 데이터의 ornYn, 신규 등록에서는 쿼리 파라미터 */
const isOrdinary = computed(() => {
    if (isEditMode.value) return form.value.ornYn === 'Y';
    return route.query.ordinary === 'true';
});
```

#### 폼 초기값 설정

```typescript
// onMounted에서 수정 모드 데이터 로드 시 ornYn 반영
if (project.ornYn === 'Y') {
    form.value.ornYn = 'Y';
}

// 신규 등록 시 쿼리 파라미터 기반 설정
if (!isEditMode.value && route.query.ordinary === 'true') {
    form.value.ornYn = 'Y';
}
```

#### 페이지 타이틀 동적 변경

```typescript
const pageTitle = computed(() => isOrdinary.value ? '경상사업 예산 작성' : '정보화사업 예산 작성');
```

#### 섹션별 v-if 매핑 (form)

| 섹션 | v-if 조건 | 비고 |
|------|-----------|------|
| 기본정보 (사업명, 유형, 연도) | 항상 표시 | |
| 사업 개요 (RichText + 현황/필요성) | 항상 표시 | |
| 기대효과 Textarea | `v-if="!isOrdinary"` | |
| 미추진 시 문제점 Textarea | `v-if="!isOrdinary"` | |
| 사업 범위 (RichText) | `v-if="!isOrdinary"` | |
| 진행 상황 (추진경과/향후계획) | `v-if="!isOrdinary"` | |
| 사업 구분 (업무/기술/사용자) | `v-if="!isOrdinary"` | |
| 편성 기준 (중복/법규) | `v-if="!isOrdinary"` | |
| 담당부서 (주관/IT부서) | `v-if="!isOrdinary"` | |
| 보고상태 | `v-if="!isOrdinary"` | |
| 시작일/종료일/추진가능성 | `v-if="!isOrdinary"` | |
| 소요예산 (자동계산) | 항상 표시 | |
| 소요자원 DataTable | 항상 표시 | |

#### 저장 시 ornYn 자동 설정

```typescript
// handleSubmit 내부
const payload = {
    ...formData,
    ornYn: isOrdinary.value ? 'Y' : 'N',
};
```

#### 저장 후 이동 경로

```typescript
// 저장 완료 후 목록으로 이동 (통합된 경로)
router.push('/info/projects');
```

### 3.3 목록 페이지 (`pages/info/projects/index.vue`)

#### 데이터 조회 변경

```typescript
// Before: ornYn='N' 필터
const { data: projectsData } = await fetchProjects({ ornYn: 'N' });

// After: 전체 조회 (ornYn 필터 제거)
const { data: projectsData } = await fetchProjects();
```

#### 구분 컬럼 추가

```html
<Column field="ornYn" header="구분" sortable style="width: 80px">
    <template #body="{ data }">
        <Tag :value="data.ornYn === 'Y' ? '경상' : '사업'"
            :class="data.ornYn === 'Y'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'"
            class="border-0" rounded />
    </template>
</Column>
```

#### 조회 Drawer에 구분 필터 추가

```typescript
const searchFilters = ref({
    name: '',
    ornYn: '' as '' | 'Y' | 'N',  // 추가: 구분 필터
    // ... 기존 필터
});
```

```html
<!-- 구분 필터 UI -->
<div class="flex flex-col gap-2">
    <label class="font-semibold">구분</label>
    <SelectButton v-model="searchFilters.ornYn"
        :options="[{ label: '전체', value: '' }, { label: '정보화사업', value: 'N' }, { label: '경상사업', value: 'Y' }]"
        optionLabel="label" optionValue="value" :allowEmpty="false" />
</div>
```

#### 필터링 로직 추가

```typescript
const filteredProjects = computed(() => {
    return projects.value.filter(project => {
        // 구분 필터
        if (searchFilters.value.ornYn && (project as any).ornYn !== searchFilters.value.ornYn) return false;
        // ... 기존 필터
    });
});
```

#### 사업명 클릭 링크 통일

```html
<NuxtLink :to="`/info/projects/${slotProps.data.prjMngNo}`" ...>
    {{ slotProps.data.prjNm }}
</NuxtLink>
```

#### 신규 등록 버튼 분기

```html
<SplitButton label="사업등록" icon="pi pi-plus"
    @click="navigateTo('/info/projects/form')"
    :model="[{ label: '경상사업 등록', icon: 'pi pi-plus', command: () => navigateTo('/info/projects/form?ordinary=true') }]" />
```

### 3.4 Budget 페이지 링크 통일

#### 변경 대상 (3개 파일)

```typescript
// Before (approval.vue, list.vue, work.vue)
_link: (p as any).ornYn === 'Y'
    ? `/info/projects/ordinary/${p.prjMngNo}`  // or /ordinary/form?id=
    : `/info/projects/${p.prjMngNo}`,

// After (모두 동일 경로)
_link: `/info/projects/${p.prjMngNo}`,
```

**참고**: `approval.vue`의 `_link`는 이미 이번 세션에서 `/info/projects/ordinary/${id}`로 수정되었으므로 최종적으로 `/info/projects/${id}`로 통일만 하면 됩니다.

## 4. API

백엔드 API 변경 없음. 기존 엔드포인트 그대로 사용.

| API | 용도 | 변경 |
|-----|------|------|
| `GET /api/projects` | 프로젝트 목록 조회 | `ornYn` 파라미터 제거 (전체 조회) |
| `GET /api/projects/:id` | 프로젝트 상세 조회 | 변경 없음 |
| `POST /api/projects` | 프로젝트 생성 | `ornYn` 필드 포함 |
| `PUT /api/projects/:id` | 프로젝트 수정 | `ornYn` 필드 포함 |
| `DELETE /api/projects/:id` | 프로젝트 삭제 | 변경 없음 |

## 5. File Changes Summary

| 파일 | Action | 변경 내용 |
|------|--------|-----------|
| `pages/info/projects/[id].vue` | Modify | +isOrdinary, +v-if 5개 섹션, +TOC 필터링, +헤더 태그, +카드 그리드 동적 |
| `pages/info/projects/form.vue` | Modify | +isOrdinary, +v-if 섹션/필드, +ornYn 자동설정, +타이틀 동적 |
| `pages/info/projects/index.vue` | Modify | ornYn 필터 제거, +구분 컬럼, +구분 필터, +SplitButton, 링크 통일 |
| `pages/budget/approval.vue` | Modify | `_link` 통일 (ordinary 분기 제거) |
| `pages/budget/list.vue` | Modify | `_link` 통일 |
| `pages/budget/work.vue` | Modify | `_link` 통일 |
| `pages/info/projects/ordinary/index.vue` | **Delete** | 통합 완료 후 제거 |
| `pages/info/projects/ordinary/[id].vue` | **Delete** | 통합 완료 후 제거 |
| `pages/info/projects/ordinary/form.vue` | **Delete** | 통합 완료 후 제거 |

## 6. Edge Cases

| 케이스 | 처리 |
|--------|------|
| ornYn이 null/undefined인 레거시 데이터 | `ornYn !== 'Y'`로 판별하므로 자동으로 일반 사업 취급 |
| 경상사업 수정 후 일반으로 변경 시도 | ornYn은 isOrdinary 기반 자동 설정이므로 사용자가 직접 변경 불가 |
| 경상사업 신규 등록 시 ?ordinary 파라미터 누락 | ornYn='N' 기본값 적용 → 일반 사업으로 등록 (의도적 설계) |
| 목록에서 전체 조회 시 데이터 증가 | 기존에도 budget 페이지에서 전체 조회 사용 중이므로 성능 영향 없음 |

## 7. Test Plan

| 시나리오 | 검증 항목 |
|----------|-----------|
| 목록: 전체 조회 | 정보화사업 + 경상사업 모두 표시, 구분 컬럼 정상 |
| 목록: 구분 필터 | '정보화사업'/'경상사업'/'전체' 필터링 정상 |
| 상세: 정보화사업 | 9개 섹션 모두 표시, TOC 전체 항목 표시 |
| 상세: 경상사업 | 4개 섹션만 표시, TOC에서 숨긴 섹션 제외 |
| 폼: 정보화사업 신규 | 전체 필드 표시, ornYn='N' 저장 |
| 폼: 경상사업 신규 | `?ordinary=true`로 진입, 축소 필드, ornYn='Y' 저장 |
| 폼: 경상사업 수정 | 기존 데이터 ornYn='Y' 로드, 축소 필드, ornYn='Y' 유지 |
| budget/approval 링크 | 경상사업 클릭 → `/info/projects/:id` 정상 이동 |
| budget/list 링크 | 경상사업 클릭 → `/info/projects/:id` 정상 이동 |

## 8. Implementation Guide

### 8.1 Implementation Order

1. **[id].vue 상세 통합** — isOrdinary + v-if + TOC 필터링
2. **form.vue 폼 통합** — isOrdinary + v-if + ornYn 자동설정
3. **index.vue 목록 통합** — 전체 조회 + 구분 컬럼/필터 + SplitButton
4. **budget 링크 통일** — approval/list/work의 _link 단순화
5. **ordinary/ 삭제** — 3개 파일 제거
6. **전체 검증** — codebase grep으로 `/ordinary/` 참조 잔여 확인

### 8.2 Key Decisions

- `isOrdinary`는 각 페이지에서 computed로 정의 (composable 추출하지 않음)
- TOC는 `filteredTocItems`로 동적 필터링 (기존 tocItems 배열은 유지)
- 목록은 SplitButton으로 일반/경상 신규등록 분기
- ornYn은 폼에서 자동 설정 (사용자 직접 변경 불가)

### 8.3 Session Guide

이 기능은 단일 세션에서 구현 가능합니다.

| Module | 파일 | 예상 작업량 |
|--------|------|------------|
| module-1 | `[id].vue` | ~30줄 수정 |
| module-2 | `form.vue` | ~25줄 수정 |
| module-3 | `index.vue` | ~40줄 수정 |
| module-4 | budget 3개 + ordinary/ 삭제 | ~10줄 수정 + 3파일 삭제 |

**권장**: 단일 세션으로 `/pdca do ordinary-consolidation` 실행
