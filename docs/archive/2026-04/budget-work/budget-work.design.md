## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 결재 완료된 예산 항목에 비목별 편성률을 적용하여 최종 편성예산을 산출하기 위함 |
| WHO | IT 예산 담당자 (예산 편성 권한 보유자) |
| RISK | 편성률 매칭 로직(DUP_IOE 접두어) 오류 시 잘못된 예산 산출 / CAPPLM 결재상태 판단 누락 시 미결재 건 포함 |
| SUCCESS | 편성률 입력·저장·조회 정상 동작 + BBUGTM 데이터 정확성 + 결재완료 건만 대상 필터링 |
| SCOPE | 백엔드(budget/work API 3종) + 프론트엔드(budget/work 페이지) + 신규 테이블(TAAABB_BBUGTM) |

---

# budget-work Design — 예산 작업

> Architecture: **Option C — Pragmatic Balance**
> 단일 Service + QueryDSL Custom Repository. 기존 budget 패턴과 일관성 유지.

## 1. Overview

예산 작업 기능은 결재완료된 정보화사업(BPROJM→BITEMM) 및 전산업무비(BCOSTM→BTERMM)의 비목별 금액에 편성률(0~100%)을 적용하여 BBUGTM 테이블에 편성예산을 저장하는 기능이다.

### 1.1 시스템 흐름

```
[사용자] 예산년도 선택 + 편성률 입력
    ↓
[프론트] POST /api/budget/work/apply
    ↓
[Controller] BudgetWorkController
    ↓
[Service] BudgetWorkService.applyRates()
    ├─ 1. CCODEM에서 DUP_IOE 편성비목 조회
    ├─ 2. 접두어 추출 (DUP-IOE-237 → "237")
    ├─ 3. 결재완료 BPROJM/BCOSTM 조회 (CAPPLA+CAPPLM JOIN)
    ├─ 4. BITEMM.GCL_DTT 또는 BCOSTM.IOE_C ↔ 접두어 매칭
    ├─ 5. 편성금액 계산: 요청금액 × (편성률/100)
    └─ 6. BBUGTM Upsert (기존이면 UPDATE, 없으면 INSERT)
    ↓
[Response] 편성 결과 summary 반환
```

---

## 2. 데이터 모델

### 2.1 신규 엔티티: Bbugtm

```java
@Entity
@Table(name = "TAAABB_BBUGTM", comment = "예산")
@IdClass(BbugtmId.class)
public class Bbugtm extends BaseEntity {
    @Id BG_MNG_NO  VARCHAR2(32)   // 예산관리번호 (S_BG 시퀀스)
    @Id BG_SNO     NUMBER(4,0)    // 예산일련번호
    BG_YY          NUMBER(4,0)    // 예산년도
    ORC_TB         VARCHAR2(10)   // 원본테이블 (BPROJM/BCOSTM)
    ORC_PK_VL      VARCHAR2(32)   // 원본PK값
    ORC_SNO_VL     NUMBER(4,0)    // 원본일련번호값
    IOE_C          VARCHAR2(100)  // 비목코드
    DUP_BG         NUMBER(15,2)   // 편성예산
    DUP_RT         NUMBER(3,0)    // 편성률 (0~100)
    // + BaseEntity 공통 필드 (DEL_YN, GUID, FST_ENR_DTM 등)
}
```

### 2.2 복합키 클래스: BbugtmId

```java
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BbugtmId implements Serializable {
    private String bgMngNo;   // BG_MNG_NO
    private Integer bgSno;    // BG_SNO
}
```

### 2.3 시퀀스 채번

```sql
-- Oracle 시퀀스 (DBA에게 생성 요청)
CREATE SEQUENCE S_BG START WITH 1 INCREMENT BY 1;

-- 채번 형식: BG-{연도}-{4자리 시퀀스}
-- 예: BG-2026-0001
SELECT 'BG-' || :bgYy || '-' || LPAD(S_BG.NEXTVAL, 4, '0') FROM DUAL
```

---

## 3. API 설계

### 3.1 API-01: 편성비목 목록 조회 (with 기존 편성률)

```
GET /api/budget/work/ioe-categories?bgYy=2026

Response 200:
[
  {
    "cdId": "DUP-IOE-237",
    "cdNm": "전산임차료(SW)",
    "cdva": "237-0700",
    "prefix": "237",
    "dupRt": 80,              // 기존 BBUGTM에서 조회 (없으면 null)
    "requestAmount": 150000000 // 해당 비목의 결재완료 요청금액 합계
  }
]
```

**구현 로직**:
1. `CodeRepository.findByCttTp("DUP_IOE")` → 편성비목 목록
2. 각 비목별 접두어 추출
3. 결재완료 BCOSTM/BITEMM에서 접두어 매칭되는 금액 합계 조회
4. 기존 BBUGTM에서 해당 연도+비목의 편성률 조회

### 3.2 API-02: 편성률 일괄 적용

```
POST /api/budget/work/apply

Request:
{
  "bgYy": 2026,
  "rates": [
    { "cdId": "DUP-IOE-237", "dupRt": 80 },
    { "cdId": "DUP-IOE-238", "dupRt": 100 }
  ]
}

Response 200:
{
  "message": "편성률이 적용되었습니다.",
  "totalRecords": 45,
  "summary": [ ... ]   // API-03과 동일 형태
}
```

**구현 로직** (BudgetWorkService.applyRates):
```
1. @Transactional 시작
2. rates 배열 순회:
   a. cdId에서 접두어 추출 (DUP-IOE-237 → "237")
   b. 결재완료 BCOSTM 조회: IOE_C LIKE '접두어%' AND 결재완료
   c. 결재완료 BITEMM 조회: GCL_DTT LIKE '접두어%' AND 결재완료
   d. 각 레코드에 대해:
      - 편성금액 = 요청금액 × (dupRt / 100), ROUND HALF UP
      - BBUGTM에서 (BG_YY, ORC_TB, ORC_PK_VL, ORC_SNO_VL, IOE_C)로 조회
      - 존재하면 UPDATE (DUP_BG, DUP_RT)
      - 없으면 INSERT (새 BG_MNG_NO 채번)
3. 저장 완료 후 summary 생성하여 반환
```

### 3.3 API-03: 편성 결과 조회

```
GET /api/budget/work/summary?bgYy=2026

Response 200:
{
  "data": [
    {
      "ioeCategory": "전산임차료(SW)",
      "ioePrefix": "237",
      "requestAmount": 150000000,
      "dupAmount": 120000000,
      "dupRt": 80
    }
  ],
  "totals": {
    "requestAmount": 500000000,
    "dupAmount": 380000000
  }
}
```

**구현 로직**:
1. BBUGTM에서 BG_YY = :bgYy AND DEL_YN = 'N' 조회
2. IOE_C 접두어 기준으로 GROUP BY
3. SUM(원본 요청금액), SUM(DUP_BG) 집계
4. CCODEM에서 비목명 매핑

---

## 4. 백엔드 상세 설계

### 4.1 패키지 구조

```
com.kdb.it.domain.budget.work/
├── controller/
│   └── BudgetWorkController.java       // REST 엔드포인트 3개
├── dto/
│   └── BudgetWorkDto.java              // 중첩 클래스: ApplyRequest, RateItem,
│                                       //   IoeCategoryResponse, SummaryResponse
├── entity/
│   ├── Bbugtm.java                     // 엔티티 (BaseEntity 상속)
│   └── BbugtmId.java                   // 복합키
├── repository/
│   ├── BbugtmRepository.java           // JpaRepository (기본 CRUD + 시퀀스)
│   ├── BbugtmRepositoryCustom.java     // QueryDSL 인터페이스
│   └── BbugtmRepositoryImpl.java       // QueryDSL 구현 (결재완료 필터 + 비목 매칭)
└── service/
    └── BudgetWorkService.java          // 비즈니스 로직
```

### 4.2 BudgetWorkController

```java
@RestController
@RequestMapping("/api/budget/work")
@RequiredArgsConstructor
@Tag(name = "BudgetWork", description = "예산 작업 API")
public class BudgetWorkController {

    private final BudgetWorkService budgetWorkService;

    @GetMapping("/ioe-categories")
    @Operation(summary = "편성비목 목록 조회")
    public ResponseEntity<List<BudgetWorkDto.IoeCategoryResponse>>
        getIoeCategories(@RequestParam Integer bgYy) { ... }

    @PostMapping("/apply")
    @Operation(summary = "편성률 일괄 적용")
    public ResponseEntity<BudgetWorkDto.ApplyResponse>
        applyRates(@RequestBody BudgetWorkDto.ApplyRequest request) { ... }

    @GetMapping("/summary")
    @Operation(summary = "편성 결과 조회")
    public ResponseEntity<BudgetWorkDto.SummaryResponse>
        getSummary(@RequestParam Integer bgYy) { ... }
}
```

### 4.3 BudgetWorkDto

```java
public class BudgetWorkDto {

    /** 편성률 적용 요청 */
    @Schema(name = "BudgetWorkApplyRequest")
    public record ApplyRequest(
        Integer bgYy,
        List<RateItem> rates
    ) {}

    /** 개별 비목 편성률 */
    @Schema(name = "BudgetWorkRateItem")
    public record RateItem(
        String cdId,    // 편성비목 코드ID (DUP-IOE-237)
        Integer dupRt   // 편성률 (0~100)
    ) {}

    /** 편성비목 응답 */
    @Schema(name = "BudgetWorkIoeCategoryResponse")
    public record IoeCategoryResponse(
        String cdId,
        String cdNm,
        String cdva,
        String prefix,
        Integer dupRt,
        BigDecimal requestAmount
    ) {}

    /** 편성 결과 요약 응답 */
    @Schema(name = "BudgetWorkSummaryResponse")
    public record SummaryResponse(
        List<SummaryItem> data,
        SummaryTotals totals
    ) {}

    public record SummaryItem(
        String ioeCategory,
        String ioePrefix,
        BigDecimal requestAmount,
        BigDecimal dupAmount,
        Integer dupRt
    ) {}

    public record SummaryTotals(
        BigDecimal requestAmount,
        BigDecimal dupAmount
    ) {}

    /** 편성률 적용 결과 응답 */
    @Schema(name = "BudgetWorkApplyResponse")
    public record ApplyResponse(
        String message,
        int totalRecords,
        SummaryResponse summary
    ) {}
}
```

### 4.4 BudgetWorkService 핵심 로직

```java
@Service
@RequiredArgsConstructor
public class BudgetWorkService {

    private final BbugtmRepository bbugtmRepository;
    private final CodeRepository codeRepository;      // 기존 재사용
    private final JPAQueryFactory queryFactory;

    /** 편성비목 목록 조회 (기존 편성률 + 요청금액 합산) */
    @Transactional(readOnly = true)
    public List<BudgetWorkDto.IoeCategoryResponse> getIoeCategories(Integer bgYy) {
        // 1. CCODEM에서 CTT_TP = 'DUP_IOE' 조회
        // 2. 각 비목별 접두어 추출
        // 3. 결재완료 원본 데이터에서 접두어 매칭 금액 합계
        // 4. 기존 BBUGTM에서 편성률 조회
    }

    /** 편성률 일괄 적용 */
    @Transactional
    public BudgetWorkDto.ApplyResponse applyRates(BudgetWorkDto.ApplyRequest request) {
        // 핵심 알고리즘은 §3.2에 정의
    }

    /** 편성 결과 조회 */
    @Transactional(readOnly = true)
    public BudgetWorkDto.SummaryResponse getSummary(Integer bgYy) {
        // BBUGTM GROUP BY 접두어 집계
    }
}
```

### 4.5 BbugtmRepository

```java
public interface BbugtmRepository
    extends JpaRepository<Bbugtm, BbugtmId>, BbugtmRepositoryCustom {

    /** Oracle 시퀀스로 예산관리번호 채번 */
    @Query(value =
        "SELECT 'BG-' || :bgYy || '-' || LPAD(S_BG.NEXTVAL, 4, '0') FROM DUAL",
        nativeQuery = true)
    String generateBgMngNo(@Param("bgYy") Integer bgYy);

    /** 특정 연도의 편성 데이터 조회 */
    List<Bbugtm> findByBgYyAndDelYn(Integer bgYy, String delYn);

    /** Upsert용: 원본 기준으로 기존 편성 데이터 조회 */
    Optional<Bbugtm> findByBgYyAndOrcTbAndOrcPkVlAndOrcSnoVlAndIoeCAndDelYn(
        Integer bgYy, String orcTb, String orcPkVl, Integer orcSnoVl,
        String ioeC, String delYn);
}
```

### 4.6 BbugtmRepositoryCustom (QueryDSL)

```java
public interface BbugtmRepositoryCustom {
    /** 결재완료 BCOSTM 중 접두어 매칭 목록 조회 */
    List<Bcostm> findApprovedCostsByPrefix(String prefix, Integer bgYy);

    /** 결재완료 BITEMM 중 접두어 매칭 목록 조회 */
    List<Bitemm> findApprovedItemsByPrefix(String prefix, Integer bgYy);

    /** 비목 접두어별 편성 결과 집계 */
    List<BudgetWorkDto.SummaryItem> aggregateSummary(Integer bgYy);
}
```

**QueryDSL 구현 핵심** (결재완료 필터):

기존 `ProjectRepositoryImpl`, `CostRepositoryImpl`의 apfSts 서브쿼리 패턴을 재사용:

```java
// BCOSTM 결재완료 필터 (기존 패턴 참조)
QBcostm bcostm = QBcostm.bcostm;
QCappla cappla = new QCappla("cappla");
QCappla cappla2 = new QCappla("cappla2");
QCapplm capplm = QCapplm.capplm;

BooleanBuilder builder = new BooleanBuilder();
builder.and(bcostm.delYn.eq("N"));
builder.and(bcostm.lstYn.eq("Y"));
builder.and(bcostm.ioeC.startsWith(prefix));  // 접두어 매칭

// 결재완료 서브쿼리 (CostRepositoryImpl 패턴 동일)
builder.and(
    JPAExpressions.selectOne()
        .from(cappla, capplm)
        .where(
            cappla.apfMngNo.eq(capplm.apfMngNo),
            cappla.orcTbCd.eq("BCOSTM"),
            cappla.orcPkVl.eq(bcostm.itMngcNo),
            capplm.apfSts.eq("결재완료"),
            cappla.apfRelSno.eq(
                JPAExpressions.select(cappla2.apfRelSno.max())
                    .from(cappla2)
                    .where(
                        cappla2.orcTbCd.eq("BCOSTM"),
                        cappla2.orcPkVl.eq(bcostm.itMngcNo))))
        .exists());
```

---

## 5. 프론트엔드 상세 설계

### 5.1 페이지: `app/pages/budget/work.vue`

```
┌──────────────────────────────────────────────────────────────┐
│  예산 작업                                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  예산년도: [Select: 2026 ▼]                                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  편성비목 설정                                          │  │
│  ├──────────────┬────────────┬────────────────────────────┤  │
│  │ 편성비목      │ 편성률(%)  │ 요청금액                   │  │
│  ├──────────────┼────────────┼────────────────────────────┤  │
│  │ 전산임차료SW  │ [InputNum] │ 150,000,000               │  │
│  │ 전산용역비    │ [InputNum] │ 200,000,000               │  │
│  │ 전산여비      │ [InputNum] │  30,000,000               │  │
│  │ 전산제비      │ [InputNum] │ 120,000,000               │  │
│  └──────────────┴────────────┴────────────────────────────┘  │
│                                                              │
│                                     [저장 Button severity=primary] │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  편성 결과                                   (저장 후 표시) │  │
│  ├──────────────┬─────────────┬────────────┬─────────────┤  │
│  │ 비목          │ 요청금액     │ 편성금액    │ 편성률(%)   │  │
│  ├──────────────┼─────────────┼────────────┼─────────────┤  │
│  │ 전산임차료SW  │ 150,000,000 │ 120,000,000│ 80          │  │
│  │ 전산용역비    │ 200,000,000 │ 200,000,000│ 100         │  │
│  │ 전산여비      │  30,000,000 │  15,000,000│ 50          │  │
│  │ 전산제비      │ 120,000,000 │          0 │ 0           │  │
│  ├──────────────┼─────────────┼────────────┼─────────────┤  │
│  │ 합계          │ 500,000,000 │ 335,000,000│ -           │  │
│  └──────────────┴─────────────┴────────────┴─────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 컴포넌트 구성

| 요소 | PrimeVue 컴포넌트 | 속성 |
|------|-------------------|------|
| 예산년도 선택 | `<Select>` | `:options="yearOptions"`, `v-model="selectedYear"` |
| 편성비목 테이블 | `<DataTable>` | `:value="categories"`, `editMode="cell"` |
| 편성률 입력 | `<InputNumber>` | `:min="0"`, `:max="100"`, `:suffix="' %'"` |
| 요청금액 표시 | `<Column>` | `formatBudget()` 유틸 사용 |
| 저장 버튼 | `<Button>` | `severity="primary"`, `label="저장"`, `@click="onSave"` |
| 결과 테이블 | `<DataTable>` | `:value="summaryData"`, columnFooter로 합계 |

### 5.3 반응형 데이터 흐름

```typescript
// 1. 연도 선택 → 편성비목 자동 로드
const selectedYear = ref<number>(new Date().getFullYear())

const { data: categories, refresh: refreshCategories } = useApiFetch<IoeCategoryResponse[]>(
  '/api/budget/work/ioe-categories',
  { query: { bgYy: selectedYear } }
)

// 2. 편성률 입력 → 로컬 상태 관리
// categories의 dupRt 값을 v-model로 직접 바인딩

// 3. 저장 → $apiFetch POST
const onSave = async () => {
  const { $apiFetch } = useNuxtApp()
  const result = await $apiFetch('/api/budget/work/apply', {
    method: 'POST',
    body: {
      bgYy: selectedYear.value,
      rates: categories.value.map(c => ({ cdId: c.cdId, dupRt: c.dupRt ?? 100 }))
    }
  })
  summaryData.value = result.summary
}

// 4. 결과 표시
const summaryData = ref<SummaryResponse | null>(null)
```

### 5.4 타입 정의

```typescript
// app/types/budget-work.ts
interface IoeCategoryResponse {
  cdId: string
  cdNm: string
  cdva: string
  prefix: string
  dupRt: number | null
  requestAmount: number
}

interface SummaryItem {
  ioeCategory: string
  ioePrefix: string
  requestAmount: number
  dupAmount: number
  dupRt: number
}

interface SummaryResponse {
  data: SummaryItem[]
  totals: { requestAmount: number; dupAmount: number }
}

interface ApplyResponse {
  message: string
  totalRecords: number
  summary: SummaryResponse
}
```

---

## 6. 편성률 매칭 로직 상세

### 6.1 접두어 추출 규칙

```
편성비목 코드ID    →  접두어
DUP-IOE-237       →  "237"
DUP-IOE-238       →  "238"
DUP-IOE-239       →  "239"

추출 방법: cdId.replace("DUP-IOE-", "")
```

### 6.2 매칭 대상

| 원본 테이블 | 매칭 컬럼 | 매칭 조건 | 금액 컬럼 |
|------------|----------|----------|----------|
| TAAABB_BCOSTM | `IOE_C` | `IOE_C LIKE '접두어%'` | `IT_MNGC_BG` |
| TAAABB_BITEMM | `GCL_DTT` | `GCL_DTT LIKE '접두어%'` | `GCL_AMT` |

### 6.3 결재완료 필터 조건

**BCOSTM**: `CAPPLA.ORC_TB_CD = 'BCOSTM'` AND 최신 `CAPPLM.APF_STS = '결재완료'`
**BPROJM→BITEMM**: `CAPPLA.ORC_TB_CD = 'BPROJM'` AND 최신 `CAPPLM.APF_STS = '결재완료'` → 해당 BPROJM의 BITEMM 조회

### 6.4 편성금액 계산

```
DUP_BG = 요청금액 × (DUP_RT / 100)

BigDecimal.multiply(BigDecimal.valueOf(dupRt))
    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
```

---

## 7. BBUGTM Upsert 전략

### 7.1 Upsert 키

기존 편성 데이터 조회 기준: `(BG_YY, ORC_TB, ORC_PK_VL, ORC_SNO_VL, IOE_C, DEL_YN='N')`

### 7.2 처리 흐름

```
for each (rate in rates):
    prefix = rate.cdId.replace("DUP-IOE-", "")
    approvedCosts = findApprovedCostsByPrefix(prefix, bgYy)
    approvedItems = findApprovedItemsByPrefix(prefix, bgYy)

    for each cost in approvedCosts:
        existing = bbugtmRepository.findBy(..., "BCOSTM", cost.itMngcNo, cost.itMngcSno, cost.ioeC, "N")
        dupBg = cost.itMngcBg × (rate.dupRt / 100)
        if existing:
            existing.update(dupBg, rate.dupRt)    // Dirty Checking
        else:
            bgMngNo = bbugtmRepository.generateBgMngNo(bgYy)
            new Bbugtm(bgMngNo, nextSno, bgYy, "BCOSTM", cost.itMngcNo, cost.itMngcSno, cost.ioeC, dupBg, rate.dupRt)
            bbugtmRepository.save(newBbugtm)

    for each item in approvedItems:
        existing = bbugtmRepository.findBy(..., "BPROJM", item.prjMngNo, item.prjSno, item.gclDtt, "N")
        dupBg = item.gclAmt × (rate.dupRt / 100)
        if existing:
            existing.update(dupBg, rate.dupRt)
        else:
            bgMngNo = bbugtmRepository.generateBgMngNo(bgYy)
            new Bbugtm(bgMngNo, nextSno, bgYy, "BPROJM", item.prjMngNo, item.prjSno, item.gclDtt, dupBg, rate.dupRt)
            bbugtmRepository.save(newBbugtm)
```

### 7.3 BG_SNO 채번

같은 `BG_MNG_NO` 내에서 일련번호 자동 증가:
```java
Integer maxSno = bbugtmRepository.findMaxBgSnoByBgMngNo(bgMngNo);
int nextSno = (maxSno == null) ? 1 : maxSno + 1;
```

---

## 8. 에러 처리

| 상황 | HTTP 코드 | 메시지 |
|------|----------|--------|
| 편성률 범위 초과 (< 0 또는 > 100) | 400 | "편성률은 0~100 사이여야 합니다." |
| 해당 연도 결재완료 데이터 없음 | 200 | 정상 응답 + totalRecords = 0 |
| 매칭되는 비목 없음 | 200 | 해당 비목 결과 0원으로 표시 |
| Oracle 시퀀스 오류 | 500 | "예산관리번호 채번 실패" |

---

## 9. 보안

- 모든 API는 JWT Bearer Token 인증 필수
- `@RequestBody` 의 `dupRt` 필드에 `@Min(0) @Max(100)` 검증
- SQL Injection 방지: QueryDSL 파라미터 바인딩 사용

---

## 10. 테스트 계획

| # | 테스트 | 유형 | 검증 항목 |
|---|--------|------|----------|
| T-01 | 편성비목 조회 API | Unit | DUP_IOE 코드 정확히 반환, 접두어 추출 정확성 |
| T-02 | 편성률 적용 API | Unit | BBUGTM 레코드 생성 건수, 금액 계산 정확성 |
| T-03 | Upsert 동작 | Unit | 동일 조건 2회 저장 시 UPDATE (INSERT 중복 없음) |
| T-04 | 결재완료 필터 | Unit | 결재중/반려 건 제외 확인 |
| T-05 | 접두어 매칭 | Unit | IOE_C='237-0700' → prefix='237' 매칭 성공 |
| T-06 | 화면 E2E | E2E | 연도 선택→편성률 입력→저장→결과 테이블 표시 |

---

## 11. Implementation Guide

### 11.1 구현 순서

| # | 작업 | 파일 | 의존성 |
|---|------|------|--------|
| 1 | Oracle 시퀀스 S_BG 생성 | DDL | 없음 |
| 2 | TAAABB_BBUGTM 테이블 생성 | DDL | S_BG |
| 3 | Bbugtm 엔티티 + BbugtmId | entity/ | 없음 |
| 4 | BbugtmRepository + Custom + Impl | repository/ | Entity |
| 5 | BudgetWorkDto | dto/ | 없음 |
| 6 | BudgetWorkService | service/ | Repository, CodeRepository |
| 7 | BudgetWorkController | controller/ | Service, Dto |
| 8 | 프론트 타입 정의 | types/budget-work.ts | 없음 |
| 9 | budget/work.vue 페이지 | pages/budget/ | API 완성 후 |

### 11.2 신규 파일 목록

**백엔드 (7파일)**:
1. `it_backend/src/main/java/com/kdb/it/domain/budget/work/entity/Bbugtm.java`
2. `it_backend/src/main/java/com/kdb/it/domain/budget/work/entity/BbugtmId.java`
3. `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java`
4. `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepositoryCustom.java`
5. `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepositoryImpl.java`
6. `it_backend/src/main/java/com/kdb/it/domain/budget/work/dto/BudgetWorkDto.java`
7. `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
8. `it_backend/src/main/java/com/kdb/it/domain/budget/work/controller/BudgetWorkController.java`

**프론트엔드 (2파일)**:
9. `it_frontend/app/types/budget-work.ts`
10. `it_frontend/app/pages/budget/work.vue`

### 11.3 Session Guide

**Module Map**:

| Module | 범위 | 파일 수 | 예상 복잡도 |
|--------|------|--------|-----------|
| module-1: Entity+Repository | 엔티티, 복합키, Repository, QueryDSL | 5 | 중 |
| module-2: Service+Controller | DTO, Service 로직, Controller | 3 | 높 |
| module-3: Frontend | 타입 정의, 페이지 Vue | 2 | 중 |

**Recommended Session Plan**:

| Session | Module | 설명 |
|---------|--------|------|
| Session 1 | module-1 | Entity/Repository 구현 + DDL 생성 |
| Session 2 | module-2 | Service 비즈니스 로직 + Controller |
| Session 3 | module-3 | 프론트엔드 페이지 구현 |

**Multi-session 실행**:
```bash
/pdca do budget-work --scope module-1    # Session 1
/pdca do budget-work --scope module-2    # Session 2
/pdca do budget-work --scope module-3    # Session 3
```
