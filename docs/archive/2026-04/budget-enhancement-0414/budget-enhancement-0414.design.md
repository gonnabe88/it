## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 예산 관련 6개 화면의 UX 개선 및 기능 보완으로 관리자와 담당자의 예산 업무 효율을 높이기 위함 |
| WHO | IT 부서 관리자, 기획통할담당자, 일반 임직원 (~3,000명 중 예산 업무 담당자) |
| RISK | 결재 일괄 상신 시 의도하지 않은 신청서 포함 가능성, 편성률 로직 오류 시 예산 금액 오차, 기간 제한 우회 가능성 |
| SUCCESS | 6개 요구사항 모두 정상 동작, 기존 기능 회귀 없음, 프론트+백엔드 기간 검증 일관성 |
| SCOPE | 프론트엔드 6개 페이지 수정 + 신규 2개 + 백엔드 API 수정/추가 |

---

# budget-enhancement-0414 Design — 전산예산 시스템 개선

> Architecture: **Option C — Pragmatic Balance**
> 재사용 확실한 것만 분리 (InlineEditCell, useBudgetPeriod), 나머지는 페이지별 직접 수정

---

## 1. Overview

6개 요구사항을 하나의 Design 문서로 통합 설계한다. 각 요구사항은 독립적인 모듈로 구현하되, 인라인 편집(REQ-5)과 기간 제한(REQ-6)은 공통 컴포넌트/composable로 분리하여 재사용한다.

---

## 2. REQ-1 설계: 결재 상신 전체 상신

### 2.1 프론트엔드 변경 (`pages/budget/approval.vue`)

**현재 구조**: DataTable에 `selectionMode="multiple"` + 체크박스 컬럼. 선택된 항목의 ID를 sessionStorage에 저장 후 `/budget/report`로 이동.

**변경 사항**:
1. DataTable에서 `selectionMode`, 체크박스 컬럼, `selectedItems` ref 제거
2. `[결재 상신]` 버튼 클릭 시 현재 조회된 전체 목록(이미 `apfSts=none`으로 미신청/반려만 조회)을 일괄 상신
3. 상신 로직: 기존과 동일하게 sessionStorage에 전체 ID 저장 후 `/budget/report`로 이동

**상세 변경**:
```
// 제거 항목
- DataTable: selection 속성, @selectionChange 핸들러
- 체크박스 Column
- selectedProjects, selectedCosts ref
- 선택 유효성 검사 로직

// 변경 항목
- 상신 버튼 핸들러: selectedItems → 전체 unifiedItems에서 ID 추출
- sessionStorage 저장: 전체 prjMngNo / itMngcNo 목록
```

### 2.2 백엔드 변경

**변경 없음** — 기존 `/budget/report` 페이지의 상신 API(신청서 생성 POST `/api/applications`)는 프론트엔드에서 전달하는 `orcItems` 목록을 그대로 처리하므로 백엔드 수정 불필요. 프론트엔드에서 전체 목록을 전달하면 자연스럽게 일괄 상신 동작.

---

## 3. REQ-2 설계: 예산 작업 편성률 개선

### 3.1 프론트엔드 변경 (`pages/budget/work.vue`)

**현재 구조**:
- 상단: 연도 선택 + [변경비목 설정] 테이블 (IoeCategoryResponse 기반, 비목별 편성률 입력)
- 하단: [대상 목록] 테이블 (결재완료 프로젝트 + 전산업무비)
- [변경비목 설정]에 입력한 편성률을 [저장] 시 전체 대상에 일괄 적용

**변경 사항**:
1. **[변경비목 설정] 테이블 전체 제거** — 관련 UI, 데이터 조회, ref 모두 삭제
2. **[대상 목록] 테이블에 편성률 컬럼 2개 추가** (자본예산/일반관리비 각각):
   - `자본예산 편성률(%)`: InputNumber, 0~100, suffix='%'
   - `일반관리비 편성률(%)`: InputNumber, 0~100, suffix='%'
   - 컬럼 위치: `일반관리비` 뒤, `담당부서` 앞
   - 사업 유형에 따라 해당 없는 컬럼은 비활성화:
     - 정보화사업(`_type === '사업'`): 자본예산/일반관리비 둘 다 편집 가능
     - 전산업무비(`_type === '비용'`): 일반관리비만 편집 가능 (자본예산 컬럼은 `-` 표시)
3. **편성률 기본값 계산 로직** (프론트엔드에서 수행):
   - 공통코드 조회: `DUP-AMT` (기준액), `DUP_IOE` (비목별 비율)
   - **자본예산 편성률 기본값**:
     - `PUL_DTT === 'PUL_DTT_001'(신규)` && `assetBg >= DUP-AMT-300(2억)` → `DUP-IOE` 비목별 비율 (기본 70%)
     - 그 외 → 100%
   - **일반관리비 편성률 기본값**:
     - `DUP-AMT-200`(기준액 0) 참조 → 모든 금액이 기준액 이상이므로 `DUP-IOE` 비목별 비율 적용 (기본 99%)
     - 전산업무비의 경우도 동일 로직 적용
4. **저장 로직**: 각 사업의 자본예산/일반관리비 편성률을 개별 저장

### 3.2 대상 목록 테이블 컬럼 구조 (변경 후)

```
| 구분 | 사업명 | 총예산 | 자본예산 | 일반관리비 | 자본예산 편성률(%) | 일반관리비 편성률(%) | 담당부서 |
```

- 정보화사업: 자본예산 편성률 + 일반관리비 편성률 둘 다 입력 가능
- 전산업무비: 일반관리비 편성률만 입력 가능 (자본예산 편성률은 `-` 비활성)

### 3.3 편성률 기본값 계산 의사코드

```typescript
interface DefaultRates {
  assetDupRt: number | null  // 자본예산 편성률 (null = 해당없음)
  costDupRt: number          // 일반관리비 편성률
}

function calculateDefaultRates(item: TargetItem, codes: CommonCodes): DefaultRates {
  const capThreshold = Number(codes['DUP-AMT-300'].cdva) // 200000000 (자본예산 기준액)
  // DUP-AMT-200 = 0 (일반관리비 기준액) → 모든 금액이 기준 이상
  
  if (item._type === '사업') {
    // 자본예산 편성률: 신규 + 기준액 이상이면 비목별 비율, 그 외 100%
    const assetDupRt = (item.pulDtt === 'PUL_DTT_001' && item.assetBg >= capThreshold)
      ? Number(codes['DUP-IOE-351'].cdva) // 70% (개발비 대표값, 비목별 세분화는 BBUGTM에서)
      : 100
    
    // 일반관리비 편성률: DUP-IOE 비목별 비율 적용 (기본 99%)
    const costDupRt = Number(codes['DUP-IOE-240'].cdva) // 99% (전산제비 대표값)
    
    return { assetDupRt, costDupRt }
  }
  
  // 전산업무비: 자본예산 없음, 일반관리비만
  return {
    assetDupRt: null, // 해당없음
    costDupRt: Number(codes['DUP-IOE-240'].cdva) // 99%
  }
}
```

### 3.4 백엔드 변경 (`BudgetWorkController`/`BudgetWorkService`)

**기존 API**: `POST /api/budget/work/apply` — 비목별 편성률 목록을 받아 전체 대상에 일괄 적용

**변경**:
- 요청 DTO 변경: 비목별 편성률 → **사업별 자본예산/일반관리비 편성률** `[{ orcTb, orcPkVl, assetDupRt, costDupRt }]`
- 서비스 로직: 각 사업별로 자본예산/일반관리비 편성률을 BBUGTM에 분리 Upsert
  - 자본예산 비목(`IOE_CPIT`)에 해당하는 BBUGTM 행 → `assetDupRt` 적용
  - 일반관리비 비목(`IOE_IDR`, `IOE_LEAFE`, `IOE_SEVS`, `IOE_XPN`)에 해당하는 BBUGTM 행 → `costDupRt` 적용
- 기존 비목별 일괄 적용 로직 제거

```java
// 변경된 요청 DTO
@Schema(name = "BudgetWorkApplyRequest", description = "사업별 편성률 적용 요청")
public static class ApplyRequest {
    List<ItemRate> items; // 사업별 편성률
}

@Schema(name = "ItemRate", description = "개별 사업 편성률 (자본예산/일반관리비 분리)")
public static class ItemRate {
    String orcTb;       // 원본 테이블 (TAAABB_BPROJM / TAAABB_BCOSTM)
    String orcPkVl;     // 원본 PK (prjMngNo / itMngcNo)
    Integer assetDupRt; // 자본예산 편성률 (0~100, null=해당없음)
    Integer costDupRt;  // 일반관리비 편성률 (0~100)
}
```

**BBUGTM Upsert 로직**:
```java
// 사업의 품목(BITEMM) 또는 전산업무비(BCOSTM) 비목코드를 기준으로 분기
for (ItemRate item : request.getItems()) {
    List<String> ioeCodeList = getIoeCodesForItem(item.orcTb, item.orcPkVl);
    for (String ioeC : ioeCodeList) {
        int dupRt;
        if (isCapitalBudgetCode(ioeC)) {       // IOE_CPIT 계열
            dupRt = item.getAssetDupRt() != null ? item.getAssetDupRt() : 100;
        } else {                                 // IOE_IDR, IOE_LEAFE, IOE_SEVS, IOE_XPN 계열
            dupRt = item.getCostDupRt();
        }
        upsertBbugtm(item.orcTb, item.orcPkVl, ioeC, dupRt);
    }
}
```

---

## 4. REQ-3 설계: 예산현황 컬럼 변경

### 4.1 프론트엔드 변경 (`pages/budget/status.vue`)

**현재 구조**: 전산업무비 탭의 `costColumns` 배열에 `편성요청` / `조정(편성)` 그룹으로 컬럼 정의.

**변경 사항**:
1. 전산업무비 탭의 컬럼 그룹 헤더 변경:
   - `편성요청` → `2025년` (전년도 편성 금액)
   - `조정(편성)` → `2026년` (당해 편성 금액)
2. 데이터 바인딩: 각 연도별 편성 금액 필드에 매핑
   - `2025년` 컬럼: 전년도(bgYy - 1) BCOSTM 데이터
   - `2026년` 컬럼: 당해(bgYy) BCOSTM 데이터

```typescript
// 변경 전
{ field: 'reqRentBg', header: '전산임차료', group: '편성요청', ... }
{ field: 'adjRentBg', header: '전산임차료', group: '조정(편성)', ... }

// 변경 후
{ field: 'prevRentBg', header: '전산임차료', group: '2025년', ... }
{ field: 'currRentBg', header: '전산임차료', group: '2026년', ... }
```

### 4.2 백엔드 변경 (`useBudgetStatus` / 관련 API)

**현재 API**: `GET /api/budget/status/cost?bgYy={year}` — 단일 연도 전산업무비 현황 반환

**변경**:
- API 응답에 전년도 편성 금액 필드 추가 (`prevRentBg`, `prevTravelBg`, `prevServiceBg`, `prevMiscBg`, `prevTotalBg`)
- 백엔드에서 bgYy와 bgYy-1 두 연도의 BCOSTM 데이터를 JOIN하여 반환
- 또는 프론트엔드에서 두 번 호출 후 매핑 (단순하지만 API 2회 호출)

**권장**: 백엔드에서 2개 연도 데이터를 한 번에 반환 (성능 우선)

---

## 5. REQ-4 설계: 전산업무비 금융정보단말기

### 5.1 프론트엔드 변경 (`pages/info/cost/index.vue`)

**변경 사항**:
1. **유형(`itMngcTp`) 컬럼 제거**: `columns` 배열에서 해당 항목 삭제
2. **금융정보단말기 여부 컬럼 추가**:
   - 컬럼명: `금융정보단말기`
   - 렌더링: 체크박스 (읽기 전용 표시)
   - 값 결정: `itMngcTp === 'IT_MNGC_TP_002'` → 체크
3. **체크박스 클릭 이벤트**:
   - 미체크 → 체크 시: `/info/cost/terminal/form?costId={itMngcNo}` 로 이동 (부모 전산업무비 연결하여 신규 작성)
   - 이미 체크된 상태에서 클릭: `/info/cost/terminal/{id}` 상세 페이지로 이동

### 5.2 프론트엔드 변경 (`pages/info/cost/terminal/form.vue`)

**현재**: `?id=값`이 있으면 수정 모드, id 없으면 빈 폼으로 신규 작성. 단, 현재 신규 작성은 UI상 비활성 상태.

**변경 사항 — 3가지 진입 모드 지원**:

| 모드 | URL | 동작 |
|------|-----|------|
| **수정** | `/info/cost/terminal/form?id={itMngcNo}` | 기존과 동일: 해당 금융정보단말기 데이터 로드하여 수정 |
| **연결 신규** | `/info/cost/terminal/form?costId={parentItMngcNo}` | 부모 전산업무비(`costId`)에서 사업코드/비목코드 등 초기값 복사 후 신규 작성. 저장 시 부모의 `itMngcTp`를 `IT_MNGC_TP_002`로 업데이트 |
| **독립 신규** | `/info/cost/terminal/form` (파라미터 없음) | itMngcNo 없이 빈 폼으로 시작. 사업코드/비목코드 등 직접 입력. 저장 시 `itMngcTp = 'IT_MNGC_TP_002'`로 새 전산업무비 생성 |

**진입 모드 판별 로직**:
```typescript
const route = useRoute()
const editId = computed(() => route.query.id as string | undefined)
const parentCostId = computed(() => route.query.costId as string | undefined)

// 모드 결정
const mode = computed(() => {
  if (editId.value) return 'edit'          // 수정 모드
  if (parentCostId.value) return 'linked'  // 연결 신규 모드
  return 'new'                              // 독립 신규 모드
})
```

**모드별 초기화**:
- `edit`: `fetchCostOnce(editId)` → 기존 데이터 로드
- `linked`: `fetchCostOnce(parentCostId)` → 부모 데이터에서 사업코드(`abusC`), 비목코드(`ioeC`), 담당부서 등 초기값 복사. `itMngcNo`는 비워둠 (서버에서 채번)
- `new`: 빈 폼. `itMngcTp = 'IT_MNGC_TP_002'` 자동 설정. 현재 사용자의 부서 정보 자동 입력

**저장 로직**:
```typescript
async function save() {
  if (mode.value === 'edit') {
    // 수정: PUT /api/cost/{itMngcNo}
    await updateCost(editId.value, formData)
  } else {
    // 신규 (linked + new): POST /api/cost + itMngcTp = 'IT_MNGC_TP_002'
    const created = await createCost({ ...formData, itMngcTp: 'IT_MNGC_TP_002' })
    
    // linked 모드일 때: 부모 전산업무비의 itMngcTp도 업데이트
    if (mode.value === 'linked' && parentCostId.value) {
      await updateCost(parentCostId.value, { itMngcTp: 'IT_MNGC_TP_002' })
    }
  }
  
  // 저장 완료 후: 현재 탭 닫고 목록으로 복귀
  removeTab()
  // /info/cost 탭 새로고침 트리거
}
```

**저장 완료 후 공통 동작**:
1. `removeTab()` 호출로 현재 탭 닫기
2. 전산업무비 목록(`/info/cost`) 탭으로 포커스 이동 + 데이터 새로고침

### 5.3 백엔드 변경

- `CostService.createCost()`: 이미 `itMngcTp` 필드를 포함하여 저장하므로 별도 수정 없음. `IT_MNGC_TP_002`를 프론트엔드에서 전달하면 자동 반영
- `CostService.updateCost()`: linked 모드에서 부모의 `itMngcTp` 업데이트 시 기존 API 재사용 가능 (별도 API 불필요)
- 금융정보단말기 전용 단말기목록(BTERMM)은 기존 terminal/form.vue의 저장 로직에서 처리 (변경 없음)

---

## 6. REQ-5 설계: 인라인 편집 개선

### 6.1 공통 컴포넌트 — `InlineEditCell.vue`

**위치**: `app/components/common/InlineEditCell.vue`

**Props**:
```typescript
interface Props {
  modelValue: string | number | null  // 현재 값
  type?: 'text' | 'number' | 'select' // 입력 타입 (기본: text)
  options?: { label: string; value: any }[]  // select 타입일 때 옵션
  disabled?: boolean                  // 편집 불가 여부
  suffix?: string                     // 접미사 (예: '원', '%')
}
```

**Emits**:
```typescript
defineEmits<{
  'update:modelValue': [value: any]   // v-model 바인딩
  'save': [value: any]                // Enter 키 또는 blur 시
  'cancel': []                        // Esc 키 시
}>()
```

**동작 로직**:
```
[View Mode] ← 기본 상태
  - 값 표시 (span)
  - 클릭 시 → [Edit Mode] 전환

[Edit Mode]
  - InputText/InputNumber/Select 표시
  - 자동 포커스 (nextTick + focus())
  - Enter 키 → emit('save', newValue), [View Mode]로 복귀
  - Esc 키 → emit('cancel'), 원래 값 복원, [View Mode]로 복귀
  - blur → emit('save', newValue), [View Mode]로 복귀 (의도하지 않은 데이터 손실 방지)
```

**구현 핵심**:
```vue
<template>
  <div @click="startEdit" class="inline-edit-cell">
    <!-- View Mode -->
    <span v-if="!editing" class="cursor-pointer hover:bg-surface-100 px-2 py-1 rounded">
      {{ displayValue }}
    </span>
    <!-- Edit Mode -->
    <InputText v-else ref="inputRef" v-model="localValue"
      @keydown.enter="save" @keydown.esc="cancel" @blur="save"
      class="w-full" />
  </div>
</template>
```

### 6.2 적용 대상

| 페이지 | 현재 방식 | 변경 |
|--------|-----------|------|
| `/info/cost/index.vue` | 항상 편집 모드 (InputText 직접 렌더링) | `<InlineEditCell>` 교체 |
| `/info/cost/terminal/form.vue` | 항상 편집 모드 | `<InlineEditCell>` 교체 |

### 6.3 저장 API 호출

- `@save` 이벤트 → 해당 행의 변경된 값으로 `updateCost` API 호출 (기존 자동저장 로직 재활용)
- `@cancel` → 로컬 값 복원, API 호출 없음

---

## 7. REQ-6 설계: 예산 신청 기간 제한

### 7.1 공통 Composable — `useBudgetPeriod.ts`

**위치**: `app/composables/useBudgetPeriod.ts`

```typescript
export function useBudgetPeriod() {
  const config = useRuntimeConfig()
  
  // 공통코드에서 기간 조회
  const { data: periodData } = useApiFetch<{ startDate: string; endDate: string }>(
    `${config.public.apiBase}/api/codes/budget-period`
  )
  
  // 현재 기간 내인지 판단
  const isWithinPeriod = computed(() => {
    if (!periodData.value) return true // 데이터 로딩 중에는 허용
    const now = new Date().toISOString().slice(0, 10)
    return now >= periodData.value.startDate && now <= periodData.value.endDate
  })
  
  // 기간 정보
  const periodInfo = computed(() => periodData.value)
  
  return { isWithinPeriod, periodInfo }
}
```

### 7.2 프론트엔드 변경 — `/budget/index.vue`

```typescript
const { isWithinPeriod, periodInfo } = useBudgetPeriod()
const showPeriodDialog = ref(false)

onMounted(() => {
  if (!isWithinPeriod.value) {
    showPeriodDialog.value = true
  }
})
```

**UI 변경**:
- 기간 외: 안내 다이얼로그 표시 (예산 신청 기간: {startDate} ~ {endDate})
- 기간 외: 3개 카드(정보화사업/전산업무비/경상사업) 비활성화 (`pointer-events-none opacity-50`)

### 7.3 미들웨어 — `budget-period.ts`

**위치**: `app/middleware/budget-period.ts`

```typescript
export default defineNuxtRouteMiddleware(async (to) => {
  // /info/projects/form, /info/cost/form, /info/cost/terminal/form 등
  // budget 관련 form 페이지 접근 시 기간 검증
  const budgetFormPaths = ['/info/projects/form', '/info/cost/form', '/info/cost/terminal/form']
  
  if (budgetFormPaths.some(path => to.path.startsWith(path))) {
    const { isWithinPeriod } = useBudgetPeriod()
    if (!isWithinPeriod.value) {
      return navigateTo('/budget')  // 예산 작성 페이지로 리다이렉트
    }
  }
})
```

**페이지 적용**: form 페이지들의 `definePageMeta`에 미들웨어 추가:
```typescript
definePageMeta({
  middleware: ['budget-period']
})
```

### 7.4 백엔드 변경 — 기간 검증 API

**1) 기간 조회 API (신규)**:
```
GET /api/codes/budget-period
Response: { "startDate": "2026-04-15", "endDate": "2026-12-31" }
```

**2) CUD API 기간 검증 (서비스 레이어)**:

`CodeService`에 기간 검증 유틸 메서드 추가:
```java
/**
 * 예산 신청 기간 내인지 검증
 * @throws CustomGeneralException 기간 외인 경우 400 Bad Request
 */
public void validateBudgetPeriod() {
    String startDate = getCodeValue("BG-RQS-STA"); // Ccodem에서 조회
    String endDate = getCodeValue("BG-RQS-END");
    String today = LocalDate.now().toString();
    
    if (today.compareTo(startDate) < 0 || today.compareTo(endDate) > 0) {
        throw new CustomGeneralException("예산 신청 기간이 아닙니다. (" + startDate + " ~ " + endDate + ")");
    }
}
```

**적용 대상 서비스**:
- `ProjectService.createProject()`, `updateProject()`, `deleteProject()`
- `CostService.createCost()`, `updateCost()`, `deleteCost()`
- 각 메서드 시작 시 `codeService.validateBudgetPeriod()` 호출

---

## 8. 데이터 모델

### 8.1 변경 없음 (DB 스키마)
이번 요구사항에서 DB 테이블/컬럼 추가는 없다. 기존 테이블과 공통코드를 활용한다.

### 8.2 참조 테이블 요약

| 테이블 | 용도 | 관련 REQ |
|--------|------|----------|
| TAAABB_CAPPLM / CAPPLA | 신청서/연결 | REQ-1 |
| TAAABB_BBUGTM | 편성률 | REQ-2, REQ-3 |
| TAAABB_BPROJM / BITEMM | 정보화사업 | REQ-2, REQ-3 |
| TAAABB_BCOSTM | 전산업무비 | REQ-3, REQ-4 |
| TAAABB_BTERMM | 금융정보단말기 | REQ-4 |
| TAAABB_CCODEM | 공통코드 | REQ-2, REQ-6 |

---

## 9. API 설계

### 9.1 변경 API

| Method | Path | 변경 내용 | REQ |
|--------|------|-----------|-----|
| POST | `/api/budget/work/apply` | 요청 DTO: 비목별 → 사업별 편성률 | REQ-2 |
| GET | `/api/budget/status/cost` | 응답에 전년도 편성 금액 필드 추가 | REQ-3 |

### 9.2 신규 API

| Method | Path | 설명 | REQ |
|--------|------|------|-----|
| GET | `/api/codes/budget-period` | 예산 신청 기간 조회 (BG-RQS-STA/END) | REQ-6 |

### 9.3 기간 검증 적용 API (400 반환 추가)

| Method | Path | REQ |
|--------|------|-----|
| POST | `/api/projects` | REQ-6 |
| PUT | `/api/projects/{id}` | REQ-6 |
| DELETE | `/api/projects/{id}` | REQ-6 |
| POST | `/api/cost` | REQ-6 |
| PUT | `/api/cost/{id}` | REQ-6 |
| DELETE | `/api/cost/{id}` | REQ-6 |

---

## 10. 파일 변경 목록

### 10.1 프론트엔드

| # | 파일 | 작업 | REQ |
|---|------|------|-----|
| F1 | `app/pages/budget/approval.vue` | 수정 — 체크박스 제거, 전체 상신 로직 | REQ-1 |
| F2 | `app/pages/budget/work.vue` | 수정 — [변경비목 설정] 제거, 편성률 컬럼 추가 | REQ-2 |
| F3 | `app/pages/budget/status.vue` | 수정 — 전산업무비 탭 컬럼 헤더/데이터 변경 | REQ-3 |
| F4 | `app/pages/info/cost/index.vue` | 수정 — 유형 컬럼 제거, 금융정보단말기 컬럼, 인라인 편집 | REQ-4, REQ-5 |
| F5 | `app/pages/info/cost/terminal/form.vue` | 수정 — costId 파라미터, 탭 닫기, 인라인 편집 | REQ-4, REQ-5 |
| F6 | `app/pages/budget/index.vue` | 수정 — 기간 체크 팝업, 버튼 비활성화 | REQ-6 |
| F7 | `app/components/common/InlineEditCell.vue` | **신규** — 클릭 기반 인라인 편집 컴포넌트 | REQ-5 |
| F8 | `app/composables/useBudgetPeriod.ts` | **신규** — 예산 기간 composable | REQ-6 |
| F9 | `app/middleware/budget-period.ts` | **신규** — form 접근 차단 미들웨어 | REQ-6 |

### 10.2 백엔드

| # | 파일 | 작업 | REQ |
|---|------|------|-----|
| B1 | `BudgetWorkController.java` / `BudgetWorkService.java` | 수정 — 사업별 편성률 적용 DTO/로직 | REQ-2 |
| B2 | `BudgetWorkDto.java` | 수정 — ApplyRequest DTO 변경 | REQ-2 |
| B3 | `CostService.java` (또는 관련 Repository) | 수정 — 다년도 전산업무비 조회 | REQ-3 |
| B4 | `CodeController.java` / `CodeService.java` | 수정 — budget-period 엔드포인트 추가 | REQ-6 |
| B5 | `ProjectService.java` | 수정 — CUD 메서드에 기간 검증 추가 | REQ-6 |
| B6 | `CostService.java` | 수정 — CUD 메서드에 기간 검증 추가 | REQ-6 |

---

## 11. Implementation Guide

### 11.1 구현 순서

| 단계 | 모듈 | 파일 | 예상 규모 |
|------|------|------|-----------|
| 1 | REQ-6 BE: 기간 검증 | B4, B5, B6 | ~60줄 |
| 2 | REQ-6 FE: 기간 UI | F6, F8, F9 | ~100줄 |
| 3 | REQ-1 FE: 결재 상신 | F1 | ~30줄 (삭제 위주) |
| 4 | REQ-5 FE: 인라인 편집 | F7 | ~80줄 (신규 컴포넌트) |
| 5 | REQ-4 FE+BE: 금융정보단말기 | F4, F5 | ~120줄 |
| 6 | REQ-2 BE: 편성률 API | B1, B2 | ~80줄 |
| 7 | REQ-2 FE: 편성률 UI | F2 | ~100줄 (삭제+추가) |
| 8 | REQ-3 BE+FE: 예산현황 | B3, F3 | ~80줄 |

### 11.2 의존성 관계

```
REQ-6 (기간 제한) ← 독립, 최우선
REQ-1 (결재 상신) ← 독립
REQ-5 (인라인 편집) ← REQ-4가 의존
REQ-4 (금융정보단말기) ← REQ-5에 의존
REQ-2 (편성률) ← 독립
REQ-3 (예산현황) ← 독립
```

### 11.3 Session Guide

**Module Map**:

| Module | REQ | 파일 | 난이도 |
|--------|-----|------|--------|
| module-1 | REQ-6 | B4, B5, B6, F6, F8, F9 | 중 |
| module-2 | REQ-1 | F1 | 하 |
| module-3 | REQ-5, REQ-4 | F7, F4, F5 | 중 |
| module-4 | REQ-2 | B1, B2, F2 | 상 |
| module-5 | REQ-3 | B3, F3 | 중 |

**Recommended Session Plan**:

| Session | Modules | 예상 시간 | 내용 |
|---------|---------|-----------|------|
| Session 1 | module-1, module-2 | 중 | 기간 제한(BE+FE) + 결재 상신 간소화 |
| Session 2 | module-3 | 중 | InlineEditCell 컴포넌트 + 금융정보단말기 |
| Session 3 | module-4 | 중~상 | 편성률 개선 (BE DTO 변경 + FE UI) |
| Session 4 | module-5 | 중 | 예산현황 컬럼 변경 (BE 다년도 조회 + FE) |

---

## 12. 테스트 계획

| # | 테스트 시나리오 | 관련 SC |
|---|----------------|---------|
| T1 | /budget/approval에서 체크박스 없이 상신 버튼 클릭 → 미신청/반려 전체 상신 | SC-1 |
| T2 | /budget/work에서 [변경비목 설정]이 없고, 대상 목록에 편성률 컬럼 존재 | SC-2 |
| T3 | 편성률 기본값: 자본예산 신규 2억 이상 → 70%, 그 외 → 100% | SC-2 |
| T4 | /budget/status 전산업무비 탭 컬럼 헤더가 [2025년]/[2026년] | SC-3 |
| T5 | /info/cost에서 유형 컬럼 없음, 금융정보단말기 체크박스 존재 | SC-4 |
| T6 | 금융정보단말기 체크 → terminal/form으로 이동 → 저장 → 탭 닫고 복귀 | SC-4 |
| T7 | 인라인 편집: 클릭 → 편집 모드, Enter → 저장, Esc → 취소 | SC-5 |
| T8 | 기간 외 /budget 접속 → 안내 팝업, 버튼 비활성화 | SC-6 |
| T9 | 기간 외 form 직접 접속 → /budget으로 리다이렉트 | SC-6 |
| T10 | 기간 외 백엔드 CUD API 호출 → 400 Bad Request | SC-6 |
| T11 | 기존 정보화사업/경상사업 탭 정상 조회 (회귀 테스트) | SC-7 |
