# Design: bulk-approval — 전산예산 일괄 결재 단일 신청서 통합

> Plan 참조: `docs/01-plan/features/bulk-approval.plan.md`

---

## 1. 변경 파일 목록

| 순번 | 파일 | 레이어 | 변경 유형 |
|------|------|--------|----------|
| 1 | `it_backend/src/main/java/com/kdb/it/dto/ApplicationDto.java` | Backend DTO | 수정 |
| 2 | `it_backend/src/main/java/com/kdb/it/service/ApplicationService.java` | Backend Service | 수정 |
| 3 | `it_frontend/app/composables/useApprovals.ts` | Frontend Composable | 수정 |
| 4 | `it_frontend/app/pages/budget/report.vue` | Frontend Page | 수정 |

변경 없는 파일: `ApplicationController.java`, `Capplm.java`, `Cappla.java`, `Cdecim.java`

---

## 2. 백엔드 설계

### 2.1 ApplicationDto.java

#### 2.1.1 추가: `OrcItem` 중첩 클래스

```java
/**
 * 원본 데이터 연결 항목 DTO
 * 단일 신청서가 복수의 원본 레코드를 연결할 때 사용합니다.
 */
@Getter
@Setter
@NoArgsConstructor
@Schema(name = "ApplicationOrcItem", description = "원본 데이터 연결 항목")
public static class OrcItem {
    /** 원본 테이블코드 (예: "BPRJTM"=정보화사업, "BITCOST"=전산관리비) */
    @Schema(description = "원본 테이블코드")
    private String orcTbCd;

    /** 원본 테이블의 PK값 (예: "PRJ-2026-0001") */
    @Schema(description = "원본 PK값")
    private String orcPkVl;

    /** 원본 테이블의 SNO값 (nullable, 예: "1") */
    @Schema(description = "원본 SNO값")
    private String orcSnoVl;
}
```

#### 2.1.2 수정: `CreateRequest` — 단일 필드 → `orcItems` 리스트

**변경 전:**
```java
private String orcTbCd;
private String orcPkVl;
private String orcSnoVl;
```

**변경 후:**
```java
/**
 * 원본 데이터 연결 항목 목록 (복수 원본 지원)
 * null 또는 빈 리스트인 경우 Cappla를 저장하지 않습니다.
 */
@Schema(description = "원본 데이터 연결 항목 목록")
private List<OrcItem> orcItems;
```

> 단일 필드(`orcTbCd`, `orcPkVl`, `orcSnoVl`)는 완전 제거.
> `POST /api/applications`를 호출하는 클라이언트는 `budget/report.vue` 단독이므로 하위 호환 불필요.

---

### 2.2 ApplicationService.java — `submit()` 메서드

#### 변경 전 (Cappla 저장 블록)

```java
// 1-1. 신청서 원본 데이터 연결 저장 (원본 테이블 코드가 있는 경우)
if (request.getOrcTbCd() != null) {
    Long seq = capplaRepository.getNextVal();
    String apfRelSno = "APPL_" + String.format("%028d", seq);

    Cappla cappla = Cappla.builder()
            .apfRelSno(apfRelSno)
            .apfMngNo(apfMngNo)
            .orcTbCd(request.getOrcTbCd())
            .orcPkVl(request.getOrcPkVl())
            .orcSnoVl(request.getOrcSnoVl() != null
                ? Integer.parseInt(request.getOrcSnoVl()) : null)
            .build();
    capplaRepository.save(cappla);
}
```

#### 변경 후 (orcItems 순회 저장)

```java
// 1-1. 원본 데이터 연결 저장 (orcItems 각각에 대해 Cappla 생성)
if (request.getOrcItems() != null && !request.getOrcItems().isEmpty()) {
    for (ApplicationDto.OrcItem item : request.getOrcItems()) {
        Long seq = capplaRepository.getNextVal(); // 항목마다 시퀀스 채번
        String apfRelSno = "APPL_" + String.format("%028d", seq);

        Cappla cappla = Cappla.builder()
                .apfRelSno(apfRelSno)               // 신청서관계일련번호 (PK)
                .apfMngNo(apfMngNo)                 // 신청관리번호 (FK)
                .orcTbCd(item.getOrcTbCd())         // 원본 테이블코드
                .orcPkVl(item.getOrcPkVl())         // 원본 PK값
                .orcSnoVl(item.getOrcSnoVl() != null
                    ? Integer.parseInt(item.getOrcSnoVl()) : null) // 원본 SNO
                .build();
        capplaRepository.save(cappla);
    }
}
```

#### 변경 범위 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| Cappla 저장 조건 | `orcTbCd != null` | `orcItems != null && !orcItems.isEmpty()` |
| Cappla 저장 건수 | 항상 1건 | `orcItems.size()`건 |
| 시퀀스 채번 | 1회 | orcItems 순회마다 1회 |

---

## 3. 프론트엔드 설계

### 3.1 useApprovals.ts — 타입 수정

#### 추가: `OrcItem` 인터페이스

```typescript
/**
 * [OrcItem] 원본 데이터 연결 항목
 * 단일 신청서가 복수의 원본 레코드를 연결할 때 배열 요소로 사용
 */
export interface OrcItem {
    orcTbCd: string;    // 원본 테이블코드 (예: 'BPRJTM', 'BITCOST')
    orcPkVl: string;    // 원본 PK값
    orcSnoVl?: string;  // 원본 SNO값 (optional)
}
```

#### 수정: `CreateApplicationRequest` 인터페이스

**변경 전:**
```typescript
export interface CreateApplicationRequest {
    apfNm: string;
    apfDtlCone?: string;
    orcTbCd: string;         // 단일 원본 테이블코드
    orcPkVl: string;         // 단일 원본 PK값
    orcSnoVl: string;        // 단일 원본 SNO값
    rqsEno: string;
    rqsOpnn: string;
    approverEnos: string[];
}
```

**변경 후:**
```typescript
export interface CreateApplicationRequest {
    apfNm: string;
    apfDtlCone?: string;
    orcItems?: OrcItem[];    // 복수 원본 연결 항목 (optional)
    rqsEno: string;
    rqsOpnn?: string;        // optional로 완화 (복수 항목 시 대표명 불확실)
    approverEnos: string[];
}
```

> 단일 필드(`orcTbCd`, `orcPkVl`, `orcSnoVl`) 완전 제거.

---

### 3.2 budget/report.vue — `submitApproval()` 재설계

#### 변경 전 (건별 루프 호출)

```typescript
// 정보화사업별 결재 신청 (건별 createApplication 호출)
const projectApplications = projects.value.map((project) => {
    return createApplication({
        apfNm: '전산예산 작성',
        apfDtlCone: JSON.stringify({ projects: [project], approvalLine: savedApprovalLine }),
        orcTbCd: 'BPRJTM',
        orcPkVl: project.prjMngNo,
        orcSnoVl: '1',
        rqsEno: approvalLine.value.drafter.id,
        rqsOpnn: project.prjNm,
        approverEnos
    });
});

// 전산업무비별 결재 신청 (건별 createApplication 호출)
const costApplications = costs.value.map((cost) => {
    return createApplication({
        apfNm: '전산예산 작성',
        apfDtlCone: JSON.stringify({ costs: [cost], approvalLine: savedApprovalLine }),
        orcTbCd: 'BITCOST',
        orcPkVl: cost.itMngcNo || '',
        orcSnoVl: '1',
        rqsEno: approvalLine.value.drafter.id,
        rqsOpnn: cost.cttNm,
        approverEnos
    });
});

await Promise.all([...projectApplications, ...costApplications]);
```

#### 변경 후 (단일 호출)

```typescript
/* ① 복수 원본 연결 항목 구성 */
const orcItems: OrcItem[] = [
    ...projects.value.map(p => ({
        orcTbCd: 'BPRJTM',
        orcPkVl: p.prjMngNo,
        orcSnoVl: '1'
    })),
    ...costs.value.map(c => ({
        orcTbCd: 'BITCOST',
        orcPkVl: c.itMngcNo || '',
        orcSnoVl: '1'
    }))
];

/* ② APF_DTL_CONE: 전체 목록 + 결재선을 하나의 JSON으로 */
const apfDtlCone = JSON.stringify({
    projects: projects.value,
    costs: costs.value,
    approvalLine: savedApprovalLine
});

/* ③ 신청의견: 단일이면 항목명, 복수이면 "외 N건" */
const totalItems = projects.value.length + costs.value.length;
const firstItemName = projects.value[0]?.prjNm || costs.value[0]?.cttNm || '';
const rqsOpnn = totalItems === 1
    ? firstItemName
    : `${firstItemName} 외 ${totalItems - 1}건`;

/* ④ 단일 createApplication 호출 */
await createApplication({
    apfNm: '전산예산 작성',
    apfDtlCone,
    orcItems,
    rqsEno: approvalLine.value.drafter.id,
    rqsOpnn,
    approverEnos
});
```

#### import 추가

```typescript
import { useApprovals, type CreateApplicationRequest, type OrcItem } from '~/composables/useApprovals';
```

---

## 4. 데이터 구조 변화 비교

### 4.1 DB 저장 결과 (3개 항목 상신 시 예시)

**변경 전:**

| 테이블 | 건수 | 내용 |
|--------|------|------|
| TAAABB_CAPPLM | 3 | APF_2026_00000001 ~ 00000003 (3개 신청서) |
| TAAABB_CAPPLA | 3 | 각 1건씩 |
| TAAABB_CDECIM | 6 | 신청서당 결재자 2명 × 3 |

**변경 후:**

| 테이블 | 건수 | 내용 |
|--------|------|------|
| TAAABB_CAPPLM | **1** | APF_2026_00000001 (단일 신청서) |
| TAAABB_CAPPLA | **3** | APPL_...0001, APPL_...0002, APPL_...0003 (원본 3개 연결) |
| TAAABB_CDECIM | **2** | 결재자 2명 (1세트) |

### 4.2 APF_DTL_CONE JSON 구조 변화

**변경 전 (단일 항목, 건별):**
```json
{ "projects": [{ "prjMngNo": "PRJ-2026-0001", ... }], "approvalLine": { ... } }
{ "costs":    [{ "itMngcNo": "COST-2026-001", ... }], "approvalLine": { ... } }
```

**변경 후 (전체 목록, 통합):**
```json
{
  "projects": [
    { "prjMngNo": "PRJ-2026-0001", "prjNm": "사업A", ... },
    { "prjMngNo": "PRJ-2026-0002", "prjNm": "사업B", ... }
  ],
  "costs": [
    { "itMngcNo": "COST-2026-001", "cttNm": "유지보수", ... }
  ],
  "approvalLine": {
    "drafter":  { "name": "홍길동", "id": "10001", "rank": "", "date": "2026.03.23" },
    "teamLead": { "name": "김팀장", "id": "20001", "rank": "", "date": "" },
    "deptHead": { "name": "이부장", "id": "30001", "rank": "", "date": "" }
  }
}
```

---

## 5. 영향 없는 로직 확인

| 기존 메서드 / 로직 | 영향 여부 | 근거 |
|------------------|-----------|------|
| `ApplicationService.approve()` | 없음 | `APF_MNG_NO` 기준 동작, DTO 구조 무관 |
| `ApplicationService.bulkApprove()` | 없음 | 동일 |
| `updateApprovalLineInDetail()` | 없음 | JSON 내 `approvalLine` 경로만 참조 |
| `ProjectService` 결재 제약 조회 | 없음 | `Cappla.orcPkVl` 기준 조회 유지 (각 원본 레코드별 1:1 Cappla 행 존재) |
| `getApplication()` / `getApplicationsByIds()` | 없음 | Capplm 조회 후 raw JSON 반환, 구조 파싱 없음 |
| `ApplicationController` | 없음 | DTO 변경만 반영, 엔드포인트 변경 없음 |

---

## 6. 구현 순서

```
Step 1. [Backend] ApplicationDto.OrcItem 클래스 추가
        + CreateRequest.orcItems 필드 추가
        + 기존 orcTbCd, orcPkVl, orcSnoVl 필드 제거

Step 2. [Backend] ApplicationService.submit() 수정
        + orcTbCd 조건 → orcItems 루프로 교체
        + Cappla 다중 저장 로직 구현

Step 3. [Frontend] useApprovals.ts 수정
        + OrcItem 인터페이스 추가
        + CreateApplicationRequest 필드 교체
        (orcTbCd/orcPkVl/orcSnoVl 제거 → orcItems 추가)

Step 4. [Frontend] budget/report.vue 수정
        + OrcItem import 추가
        + submitApproval() 단일 createApplication 호출로 재작성

Step 5. [Build] 백엔드 컴파일 확인 (./gradlew build)

Step 6. [QA] 2건 이상 선택 → 상신 → DB 확인
        - CAPPLM 1행 생성
        - CAPPLA N행 생성 (선택 건수)
        - CDECIM 2행 생성 (결재자 2명)
        - APF_DTL_CONE에 projects/costs 배열 포함 확인
```

---

## 7. 검증 시나리오

| 시나리오 | 기대 결과 |
|---------|----------|
| 정보화사업 2건 + 전산업무비 1건 선택 후 상신 | CAPPLM 1행, CAPPLA 3행, CDECIM 2행 |
| 정보화사업 1건만 선택 후 상신 | CAPPLM 1행, CAPPLA 1행, CDECIM 2행 |
| 전산업무비 2건만 선택 후 상신 | CAPPLM 1행, CAPPLA 2행, CDECIM 2행 |
| 상신된 신청서 결재 (팀장 승인) | 기존과 동일하게 정상 처리 |
| 상신된 신청서 결재 (부서장 승인 → 결재완료) | APF_STS='결재완료' |
| 결재중 프로젝트 수정 시도 | 기존 제약 로직 동일 적용 (Cappla → Capplm 조회) |
| APF_DTL_CONE 구조 확인 | `{ projects: [...], costs: [...], approvalLine: {...} }` |
