# Plan: bulk-approval — 전산예산 일괄 결재 단일 신청서 통합

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | bulk-approval |
| 작성일 | 2026-03-23 |
| 대상 파일 | it_backend · it_frontend (2개 레이어) |
| 예상 범위 | 백엔드 2파일 수정, 프론트엔드 1파일 수정 |

### Value Delivered

| 관점 | 내용 |
|------|------|
| Problem | 2건 이상 일괄 상신 시 건별로 신청서 번호(APF_MNG_NO)가 발행되어, 결재권자가 N건의 분리된 신청서를 각각 결재해야 하는 불편함 |
| Solution | 한 번의 상신으로 단일 APF_MNG_NO를 발행하고 복수의 원본 데이터(Cappla)를 연결, APF_DTL_CONE에 전체 목록을 JSON list로 저장 |
| Function UX Effect | 결재 화면에서 "1건의 신청서 결재"로 처리 → 결재 건수 최소화, 신청/결재 과정 단순화 |
| Core Value | 업무 효율성 향상 및 결재 이력의 일관성 확보 |

---

## 1. 현황 분석 (AS-IS)

### 1.1 현재 흐름

```
[budget/report.vue] submitApproval()
  └─ projects.value.map(p  → createApplication({ orcPkVl: p.prjMngNo, ... }))  ← 건별 호출
  └─ costs.value.map(c     → createApplication({ orcPkVl: c.itMngcNo, ... }))  ← 건별 호출
  └─ Promise.all([...all])

[ApplicationService.submit()]  ← 각 호출마다
  1. Oracle SEQ → APF_MNG_NO 채번          ← 건수만큼 발생
  2. TAAABB_CAPPLM INSERT 1건              ← 건수만큼 발생
  3. TAAABB_CAPPLA INSERT 1건              ← 건수만큼 발생
  4. TAAABB_CDECIM INSERT (결재자 수)건    ← 건수만큼 발생
```

**문제점:**
- 3건 선택 → APF_MNG_NO 3개 + Capplm 3행 + Cappla 3행 + Cdecim 6행(결재자2×3)
- 결재권자는 동일 결재선으로 3번 결재 필요
- APF_DTL_CONE이 단일 프로젝트/비용 JSON → 목록 조회 시 데이터 분산

### 1.2 관련 파일 현황

| 파일 | 현재 역할 | 변경 필요 |
|------|-----------|----------|
| `it_frontend/app/pages/budget/report.vue` | 건별 `createApplication` 호출 | ✅ |
| `it_backend/.../dto/ApplicationDto.java` | `CreateRequest`에 단일 `orcTbCd/orcPkVl/orcSnoVl` | ✅ |
| `it_backend/.../service/ApplicationService.java` | `submit()`이 단일 Cappla 저장 | ✅ |
| `it_backend/.../controller/ApplicationController.java` | POST `/api/applications` 엔드포인트 | ❌ 변경 없음 |
| `it_backend/.../domain/entity/Capplm.java` | 신청서 마스터 엔티티 | ❌ 변경 없음 |
| `it_backend/.../domain/entity/Cappla.java` | 원본 연결 엔티티 | ❌ 변경 없음 |

---

## 2. 목표 설계 (TO-BE)

### 2.1 목표 흐름

```
[budget/report.vue] submitApproval()
  └─ createApplication({
       apfNm: '전산예산 작성',
       apfDtlCone: JSON({ projects:[...], costs:[...], approvalLine }),
       orcItems: [
         { orcTbCd:'BPRJTM', orcPkVl:'PRJ-2026-0001', orcSnoVl:'1' },
         { orcTbCd:'BPRJTM', orcPkVl:'PRJ-2026-0002', orcSnoVl:'1' },
         { orcTbCd:'BITCOST', orcPkVl:'COST-2026-001', orcSnoVl:'1' },
       ],
       rqsEno, rqsOpnn, approverEnos
     })                                          ← 단 1회 호출

[ApplicationService.submit()]
  1. Oracle SEQ → APF_MNG_NO 채번 1회
  2. TAAABB_CAPPLM INSERT 1행
  3. TAAABB_CAPPLA INSERT (orcItems.size())행   ← 복수 연결
  4. TAAABB_CDECIM INSERT (결재자 수)행         ← 1세트
```

### 2.2 APF_DTL_CONE JSON 구조 (변경 후)

```json
{
  "projects": [
    { "prjMngNo": "PRJ-2026-0001", "prjNm": "...", ... },
    { "prjMngNo": "PRJ-2026-0002", "prjNm": "...", ... }
  ],
  "costs": [
    { "itMngcNo": "COST-2026-001", "cttNm": "...", ... }
  ],
  "approvalLine": {
    "drafter": { "name": "홍길동", "id": "10001", "rank": "", "date": "2026.03.23" },
    "teamLead": { "name": "김팀장", "id": "20001", "rank": "", "date": "" },
    "deptHead": { "name": "이부장", "id": "30001", "rank": "", "date": "" }
  }
}
```

> 기존 단일 구조(`{ projects: [p], approvalLine }`)에서 list 구조로 확장.
> `updateApprovalLineInDetail()` 메서드는 `approvalLine` 경로만 참조하므로 **변경 없음**.

---

## 3. 변경 범위 상세

### 3.1 [백엔드] ApplicationDto.java

**추가할 DTO: `OrcItem`**
```java
// 원본 데이터 연결 항목 (다중 원본 지원용)
@Getter @Setter @NoArgsConstructor
public static class OrcItem {
    private String orcTbCd;   // 원본 테이블코드
    private String orcPkVl;   // 원본 PK값
    private String orcSnoVl;  // 원본 SNO값 (nullable)
}
```

**`CreateRequest` 수정:**
- `orcTbCd`, `orcPkVl`, `orcSnoVl` 단일 필드 → **`orcItems: List<OrcItem>`** 으로 교체
- 하위 호환: 기존 단일 필드를 유지하되 `@Deprecated` 처리 (또는 완전 제거)

> 현재 단일 필드를 사용하는 다른 API 호출 여부를 확인 후 결정.
> → `ApplicationController`에서 `POST /api/applications`를 호출하는 클라이언트는 `budget/report.vue` 단독이므로 **완전 교체** 가능.

### 3.2 [백엔드] ApplicationService.java — `submit()` 수정

```
변경 전: orcTbCd != null → Cappla 1건 저장
변경 후: orcItems != null && !orcItems.isEmpty() → orcItems 순회하여 Cappla N건 저장
```

- 각 `OrcItem`마다 `capplaRepository.getNextVal()` 호출 → 개별 `APF_REL_SNO` 채번
- `apfNm` 생성: 복수일 경우 대표 이름 사용 (예: `프로젝트 외 N건` or 프론트에서 전달)

### 3.3 [프론트엔드] budget/report.vue — `submitApproval()` 수정

```typescript
// 변경 전: 건별 루프로 createApplication 호출
const projectApplications = projects.value.map(p => createApplication({...}));
const costApplications = costs.value.map(c => createApplication({...}));
await Promise.all([...projectApplications, ...costApplications]);

// 변경 후: 단 1건 createApplication 호출
const orcItems = [
  ...projects.value.map(p => ({ orcTbCd: 'BPRJTM', orcPkVl: p.prjMngNo, orcSnoVl: '1' })),
  ...costs.value.map(c => ({ orcTbCd: 'BITCOST', orcPkVl: c.itMngcNo || '', orcSnoVl: '1' })),
];
const apfDtlCone = JSON.stringify({
  projects: projects.value,
  costs: costs.value,
  approvalLine: savedApprovalLine
});
await createApplication({ apfNm: '전산예산 작성', apfDtlCone, orcItems, rqsEno, rqsOpnn, approverEnos });
```

### 3.4 [프론트엔드] composables/useApprovals.ts — `CreateApplicationRequest` 타입 수정

```typescript
// OrcItem 타입 추가
interface OrcItem {
  orcTbCd: string;
  orcPkVl: string;
  orcSnoVl?: string;
}

// CreateApplicationRequest 수정
export interface CreateApplicationRequest {
  apfNm: string;
  apfDtlCone: string;
  orcItems?: OrcItem[];          // 신규: 복수 원본 연결
  orcTbCd?: string;              // 기존 (하위 호환, deprecated)
  orcPkVl?: string;              // 기존 (하위 호환, deprecated)
  orcSnoVl?: string;             // 기존 (하위 호환, deprecated)
  rqsEno: string;
  rqsOpnn?: string;
  approverEnos: string[];
}
```

---

## 4. 영향 범위 분석

### 4.1 결재 처리 로직 영향 없음

| 기존 메서드 | 영향 여부 | 이유 |
|------------|-----------|------|
| `approve()` | ❌ 없음 | APF_MNG_NO 기준으로 처리, 구조 무관 |
| `bulkApprove()` | ❌ 없음 | 동일 |
| `updateApprovalLineInDetail()` | ❌ 없음 | JSON 내 `approvalLine` 경로만 참조 |
| `getApplication()` | ❌ 없음 | Capplm 단건 조회, APF_DTL_CONE raw 반환 |

### 4.2 프로젝트/비용 결재상태 조회 (수정 불가 제약)

- `ProjectService.updateProject()` 등에서 Cappla → Capplm 조회로 `결재중/결재완료` 여부 확인
- **변경 후에도** 각 원본 레코드(PRJ_MNG_NO)에 대응하는 Cappla 행이 여전히 1:1로 존재
- → 제약 로직 **영향 없음** ✅

### 4.3 기존 데이터 호환성

- 이미 저장된 단일 신청서 데이터(`{ projects: [p] }`)는 그대로 유효
- 새 구조(`{ projects: [...], costs: [...] }`)는 추가 형식이므로 파싱 충돌 없음

---

## 5. 구현 순서 (Implementation Order)

```
① ApplicationDto.CreateRequest 수정 + OrcItem 추가   [Backend]
② ApplicationService.submit() 수정                   [Backend]
③ CreateApplicationRequest 타입 수정                 [Frontend]
④ budget/report.vue submitApproval() 수정             [Frontend]
⑤ 통합 테스트: 2건 이상 선택 → 상신 → DB 확인        [QA]
```

---

## 6. 체크리스트

- [ ] `ApplicationDto.OrcItem` 중첩 클래스 추가
- [ ] `ApplicationDto.CreateRequest.orcItems` 필드 추가 (기존 단일 필드 제거)
- [ ] `ApplicationService.submit()` — orcItems 루프로 Cappla 다중 저장
- [ ] `useApprovals.ts` — `OrcItem`, `CreateApplicationRequest` 타입 수정
- [ ] `budget/report.vue` — `submitApproval()` 단일 호출로 리팩토링
- [ ] 빌드 오류 없음 확인 (`./gradlew build`)
- [ ] DB 확인: CAPPLM 1행 / CAPPLA N행 / CDECIM (결재자수)행 생성 여부
- [ ] 기존 프로젝트 결재상태 조회 로직 동작 이상 없음

---

## 7. 비고

- `rqsOpnn` (신청의견): 단일 항목일 때는 해당 항목명, 복수일 때는 `{대표항목명} 외 N건` 형식 권장
- `apfNm` (신청서명): 현재 '전산예산 작성' 고정 → 변경 없음
- 경상사업(ornYn='Y')은 정보화사업과 같은 BPROJM 테이블이므로 `orcTbCd: 'BPRJTM'` 동일 사용
