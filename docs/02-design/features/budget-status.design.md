## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | budget-status (예산 현황) |
| 작성일 | 2026-04-12 |
| 단계 | Design |
| 선택 설계안 | **Option B — Clean Architecture** |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 예산 편성률 반영 최종 금액을 포함한 사업별 상세 내역 조회 화면이 없어 관리자가 별도 취합 필요 |
| WHO | IT 부서 관리자, 기획통할담당자, 시스템관리자 (~3,000명 사내 임직원 중 예산 관련 담당자) |
| RISK | 대량 컬럼(최대 34개) 테이블 렌더링 성능, Bbugtm 데이터 미존재 시 조정 금액 null 처리 |
| SUCCESS | 3개 탭 모두 정상 조회, 편성요청 금액 × 편성률 = 조정 금액 일치, 컬럼 선택/해제 동작 |
| SCOPE | 프론트엔드 신규 페이지 1개(3탭) + 백엔드 API 3개 + 전용 QueryDSL Repository |

---

# budget-status Design — 예산 현황 조회 (Clean Architecture)

## 1. Overview

### 1.1 설계 방향
Option B (Clean Architecture)를 선택하여 `budget/status` 패키지를 완전 분리한다. 탭별 전용 QueryDSL 쿼리로 DB 레벨에서 조인+피벗을 처리하여 프론트엔드에 단일 API 호출로 정제된 데이터를 전달한다.

### 1.2 설계 근거
- 정보화사업 탭: BPROJM + BITEMM(품목구분별 피벗) + BBUGTM(비목별 피벗) 3중 조인 필요
- 전산업무비 탭: BCOSTM + BBUGTM 조인 (비목별 매핑)
- 경상사업 탭: BPROJM(ORN_YN='Y') + BITEMM 조인 (기계장치/기타무형자산 분리)
- 각 탭의 쿼리 구조가 상이하므로 전용 Repository에서 탭별 최적화 쿼리를 구현

---

## 2. 데이터 모델

### 2.1 기존 엔티티 (재활용, 변경 없음)

| 엔티티 | 테이블 | 용도 |
|--------|--------|------|
| Bprojm | TAAABB_BPROJM | 정보화사업 마스터 (복합키: PRJ_MNG_NO + PRJ_SNO) |
| Bitemm | TAAABB_BITEMM | 프로젝트 품목 (복합키: GCL_MNG_NO + GCL_SNO) |
| Bcostm | TAAABB_BCOSTM | 전산업무비 마스터 (복합키: IT_MNGC_NO + IT_MNGC_SNO) |
| Bbugtm | TAAABB_BBUGTM | 예산 편성 결과 (복합키: BG_MNG_NO + BG_SNO) |

### 2.2 Bbugtm 연결 구조

```
BBUGTM.ORC_TB = 'BITEMM'  → ORC_PK_VL = BITEMM.GCL_MNG_NO
BBUGTM.ORC_TB = 'BCOSTM'  → ORC_PK_VL = BCOSTM.IT_MNGC_NO
BBUGTM.IOE_C             → 비목코드 (BITEMM.GCL_DTT 또는 BCOSTM.IOE_C 접두어 매칭)
BBUGTM.DUP_BG            → 편성예산 (요청금액 × DUP_RT / 100)
BBUGTM.DUP_RT            → 편성률 (0~100)
```

### 2.3 편성비목(IOE_C) 매핑 규칙

편성비목 코드(CCODEM.CTT_TP='DUP_IOE')의 접두어로 품목구분/비목코드를 매칭한다.

| 편성비목 접두어 | 매핑 대상 | 화면 표시명 |
|----------------|----------|-----------|
| IOE-237 | 개발비 | 개발비 |
| IOE-238 | 기계장치 | 기계장치 |
| IOE-239 | 기타무형자산 | 기타무형자산 |
| IOE-231 | 전산임차료 | 전산임차료 |
| IOE-232 | 전산여비 | 전산여비 |
| IOE-233 | 전산용역비 | 전산용역비 |
| IOE-234 | 전산제비 | 전산제비 |

> **참고**: 실제 접두어 값은 CCODEM 데이터에서 동적으로 조회. 위 표는 예시.

---

## 3. 백엔드 설계

### 3.1 패키지 구조

```
com.kdb.it.domain.budget.status/
├── controller/
│   └── BudgetStatusController.java     — REST 엔드포인트 3개
├── service/
│   └── BudgetStatusService.java        — 비즈니스 로직 + DTO 변환
├── dto/
│   └── BudgetStatusDto.java            — 응답 DTO (탭별 중첩 record)
└── repository/
    ├── BudgetStatusQueryRepository.java — QueryDSL 쿼리 인터페이스
    └── BudgetStatusQueryRepositoryImpl.java — QueryDSL 구현체
```

### 3.2 API 명세

#### API-01: 정보화사업 조회
```
GET /api/budget/status/projects?bgYy={year}
```

**응답 구조**:
```json
[
  {
    "prjMngNo": "PRJ-2026-0001",
    "prjTp": "신규개발",
    "pulDtt": "신규",
    "prjNm": "AI 기반 문서 분류 시스템",
    "prjDes": "AI를 활용한 자동 문서 분류...",
    "svnHdq": "디지털본부",
    "svnDpm": "IT기획부",
    "svnDpmTlr": "홍길동",
    "svnDpmCgpr": "김철수",
    "itDpm": "IT개발부",
    "itDpmTlr": "이영희",
    "itDpmCgpr": "박민수",
    "prjPulPtt": 85,
    "sttDt": "2026-03-01",
    "endDt": "2026-12-31",
    "rprSts": "보고완료",
    "edrt": "부문장",
    "reqDevBg": 500000000,
    "reqMachBg": 200000000,
    "reqIntanBg": 100000000,
    "reqAssetBg": 800000000,
    "reqRentBg": 50000000,
    "reqTravelBg": 10000000,
    "reqServiceBg": 30000000,
    "reqMiscBg": 5000000,
    "reqCostBg": 95000000,
    "reqTotalBg": 895000000,
    "adjDevBg": 450000000,
    "adjMachBg": 180000000,
    "adjIntanBg": 90000000,
    "adjAssetBg": 720000000,
    "adjRentBg": 45000000,
    "adjTravelBg": 9000000,
    "adjServiceBg": 27000000,
    "adjMiscBg": 4500000,
    "adjCostBg": 85500000,
    "adjTotalBg": 805500000
  }
]
```

#### API-02: 전산업무비 조회
```
GET /api/budget/status/costs?bgYy={year}
```

**응답 구조**:
```json
[
  {
    "itMngcNo": "COST-2026-0001",
    "pulDtt": "신규",
    "abusC": "BUS-001",
    "ioeC": "IOE-231-0100",
    "biceDpm": "IT인프라부",
    "biceTem": "서버팀",
    "cttNm": "클라우드 서비스 이용료",
    "cttOpp": "(주)클라우드코리아",
    "infPrtYn": "N",
    "itMngcTp": "클라우드",
    "reqRentBg": 120000000,
    "reqTravelBg": 0,
    "reqServiceBg": 0,
    "reqMiscBg": 0,
    "reqTotalBg": 120000000,
    "adjRentBg": 108000000,
    "adjTravelBg": 0,
    "adjServiceBg": 0,
    "adjMiscBg": 0,
    "adjTotalBg": 108000000
  }
]
```

#### API-03: 경상사업 조회
```
GET /api/budget/status/ordinary?bgYy={year}
```

**응답 구조**:
```json
[
  {
    "prjMngNo": "PRJ-2026-0050",
    "pulDtt": "계속",
    "prjNm": "서버 인프라 경상 유지보수",
    "prjDes": "기존 서버 인프라 경상 유지...",
    "machCur": "KRW",
    "machQtt": 10,
    "machUnitPrice": 5000000,
    "machAmt": 50000000,
    "machAmtKrw": 50000000,
    "intanCur": "USD",
    "intanQtt": 5,
    "intanUnitPrice": 10000,
    "intanAmt": 50000,
    "intanAmtKrw": 65000000
  }
]
```

### 3.3 BudgetStatusDto 설계

```java
public class BudgetStatusDto {

    // === 정보화사업 응답 DTO ===
    @Schema(name = "BudgetStatusProjectResponse", description = "예산 현황 - 정보화사업 응답")
    public record ProjectResponse(
        String prjMngNo,          // 프로젝트관리번호
        String prjTp,             // 프로젝트유형
        String pulDtt,            // 신규/계속
        String prjNm,             // 사업명
        String prjDes,            // 사업개요
        String svnHdq,            // 주관부문
        String svnDpm,            // 주관부서
        String svnDpmTlr,         // 주관팀 담당팀장
        String svnDpmCgpr,        // 주관팀 담당자
        String itDpm,             // IT담당부서
        String itDpmTlr,          // IT담당팀장
        String itDpmCgpr,         // IT담당자
        Integer prjPulPtt,        // 추진가능성
        LocalDate sttDt,          // 시작일자
        LocalDate endDt,          // 종료일자
        String rprSts,            // 사전보고
        String edrt,              // 전결권
        // 편성요청 금액
        BigDecimal reqDevBg,      // 편성요청 개발비
        BigDecimal reqMachBg,     // 편성요청 기계장치
        BigDecimal reqIntanBg,    // 편성요청 기타무형자산
        BigDecimal reqAssetBg,    // 편성요청 자본예산(소계)
        BigDecimal reqRentBg,     // 편성요청 전산임차료
        BigDecimal reqTravelBg,   // 편성요청 전산여비
        BigDecimal reqServiceBg,  // 편성요청 전산용역비
        BigDecimal reqMiscBg,     // 편성요청 전산제비
        BigDecimal reqCostBg,     // 편성요청 일반관리비(소계)
        BigDecimal reqTotalBg,    // 편성요청 총 사업예산(합계)
        // 조정(편성) 금액
        BigDecimal adjDevBg,      // 조정 개발비
        BigDecimal adjMachBg,     // 조정 기계장치
        BigDecimal adjIntanBg,    // 조정 기타무형자산
        BigDecimal adjAssetBg,    // 조정 자본예산(소계)
        BigDecimal adjRentBg,     // 조정 전산임차료
        BigDecimal adjTravelBg,   // 조정 전산여비
        BigDecimal adjServiceBg,  // 조정 전산용역비
        BigDecimal adjMiscBg,     // 조정 전산제비
        BigDecimal adjCostBg,     // 조정 일반관리비(소계)
        BigDecimal adjTotalBg     // 조정 총 사업예산(합계)
    ) {}

    // === 전산업무비 응답 DTO ===
    @Schema(name = "BudgetStatusCostResponse", description = "예산 현황 - 전산업무비 응답")
    public record CostResponse(
        String itMngcNo,          // 전산업무비 관리번호
        String pulDtt,            // 신규/계속
        String abusC,             // 사업코드
        String ioeC,              // 비목코드
        String biceDpm,           // 담당부서
        String biceTem,           // 담당팀
        String cttNm,             // 계약명
        String cttOpp,            // 계약업체명
        String infPrtYn,          // 정보보호
        String itMngcTp,          // 유형
        // 편성요청 금액
        BigDecimal reqRentBg,     // 편성요청 전산임차료
        BigDecimal reqTravelBg,   // 편성요청 전산여비
        BigDecimal reqServiceBg,  // 편성요청 전산용역비
        BigDecimal reqMiscBg,     // 편성요청 전산제비
        BigDecimal reqTotalBg,    // 편성요청 일반관리비(합계)
        // 조정(편성) 금액
        BigDecimal adjRentBg,     // 조정 전산임차료
        BigDecimal adjTravelBg,   // 조정 전산여비
        BigDecimal adjServiceBg,  // 조정 전산용역비
        BigDecimal adjMiscBg,     // 조정 전산제비
        BigDecimal adjTotalBg     // 조정 일반관리비(합계)
    ) {}

    // === 경상사업 응답 DTO ===
    @Schema(name = "BudgetStatusOrdinaryResponse", description = "예산 현황 - 경상사업 응답")
    public record OrdinaryResponse(
        String prjMngNo,          // 프로젝트관리번호
        String pulDtt,            // 신규/계속
        String prjNm,             // 사업명
        String prjDes,            // 사업개요
        // 기계장치
        String machCur,           // 기계장치 통화
        BigDecimal machQtt,       // 기계장치 수량
        BigDecimal machUnitPrice, // 기계장치 단가
        BigDecimal machAmt,       // 기계장치 금액
        BigDecimal machAmtKrw,    // 기계장치 금액(원화환산)
        // 기타무형자산
        String intanCur,          // 기타무형자산 통화
        BigDecimal intanQtt,      // 기타무형자산 수량
        BigDecimal intanUnitPrice,// 기타무형자산 단가
        BigDecimal intanAmt,      // 기타무형자산 금액
        BigDecimal intanAmtKrw    // 기타무형자산 금액(원화환산)
    ) {}
}
```

### 3.4 BudgetStatusQueryRepository 설계

```java
public interface BudgetStatusQueryRepository {

    /**
     * 정보화사업 예산 현황 조회
     * BPROJM(ORN_YN='N', LST_YN='Y') LEFT JOIN BITEMM(품목구분별 피벗) LEFT JOIN BBUGTM(비목별 피벗)
     */
    List<BudgetStatusDto.ProjectResponse> findProjectStatus(String bgYy);

    /**
     * 전산업무비 예산 현황 조회
     * BCOSTM(LST_YN='Y') LEFT JOIN BBUGTM(비목별 매핑)
     */
    List<BudgetStatusDto.CostResponse> findCostStatus(String bgYy);

    /**
     * 경상사업 예산 현황 조회
     * BPROJM(ORN_YN='Y', LST_YN='Y') LEFT JOIN BITEMM(기계장치/기타무형자산 분리)
     */
    List<BudgetStatusDto.OrdinaryResponse> findOrdinaryStatus(String bgYy);
}
```

### 3.5 QueryDSL 쿼리 전략

#### 정보화사업 쿼리 (findProjectStatus)

```sql
SELECT
    p.PRJ_MNG_NO, p.PRJ_TP, p.PUL_DTT, p.PRJ_NM, p.PRJ_DES,
    p.SVN_HDQ, p.SVN_DPM, p.SVN_DPM_TLR, p.SVN_DPM_CGPR,
    p.IT_DPM, p.IT_DPM_TLR, p.IT_DPM_CGPR,
    p.PRJ_PUL_PTT, p.STT_DT, p.END_DT, p.RPR_STS, p.EDRT,
    -- 편성요청: BITEMM에서 품목구분별 SUM(GCL_AMT * COALESCE(XCR,1))
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-237%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS reqDevBg,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-238%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS reqMachBg,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-239%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS reqIntanBg,
    -- 자본예산(소계) = reqDevBg + reqMachBg + reqIntanBg
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-231%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS reqRentBg,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-232%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS reqTravelBg,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-233%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS reqServiceBg,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-234%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS reqMiscBg,
    -- 일반관리비(소계) = reqRentBg + reqTravelBg + reqServiceBg + reqMiscBg
    -- 조정: BBUGTM에서 ORC_TB='BITEMM' AND 비목별 SUM(DUP_BG)
    SUM(CASE WHEN b.IOE_C LIKE 'IOE-237%' THEN b.DUP_BG ELSE 0 END) AS adjDevBg,
    SUM(CASE WHEN b.IOE_C LIKE 'IOE-238%' THEN b.DUP_BG ELSE 0 END) AS adjMachBg,
    -- ... (동일 패턴)
FROM TAAABB_BPROJM p
LEFT JOIN TAAABB_BITEMM i
    ON i.PRJ_MNG_NO = p.PRJ_MNG_NO AND i.PRJ_SNO = p.PRJ_SNO
    AND i.DEL_YN = 'N' AND i.LST_YN = 'Y'
LEFT JOIN TAAABB_BBUGTM b
    ON b.ORC_TB = 'BITEMM' AND b.ORC_PK_VL = i.GCL_MNG_NO
    AND b.BG_YY = :bgYy AND b.DEL_YN = 'N'
WHERE p.BG_YY = :bgYy
  AND p.ORN_YN != 'Y'  -- 경상사업 제외
  AND p.DEL_YN = 'N'
  AND p.LST_YN = 'Y'
GROUP BY p.PRJ_MNG_NO, p.PRJ_SNO, p.PRJ_TP, p.PUL_DTT, p.PRJ_NM, p.PRJ_DES,
         p.SVN_HDQ, p.SVN_DPM, p.SVN_DPM_TLR, p.SVN_DPM_CGPR,
         p.IT_DPM, p.IT_DPM_TLR, p.IT_DPM_CGPR,
         p.PRJ_PUL_PTT, p.STT_DT, p.END_DT, p.RPR_STS, p.EDRT
ORDER BY p.PRJ_MNG_NO
```

**구현 방식**: QueryDSL CASE WHEN + SUM + GROUP BY로 피벗 처리. 소계/합계는 Service에서 후계산.

> **참고**: 편성비목 접두어(IOE-237 등)는 하드코딩하지 않고 CCODEM에서 조회한 값을 사용한다. QueryDSL의 `CaseBuilder`와 `StringExpression.startsWith()`로 동적 CASE WHEN을 구성한다.

#### 전산업무비 쿼리 (findCostStatus)

```sql
SELECT
    c.IT_MNGC_NO, c.PUL_DTT, c.ABUS_C, c.IOE_C,
    c.BICE_DPM, c.BICE_TEM, c.CTT_NM, c.CTT_OPP,
    c.INF_PRT_YN, c.IT_MNGC_TP,
    -- 편성요청: IOE_C 접두어별 IT_MNGC_BG * COALESCE(XCR,1) 분배
    CASE WHEN c.IOE_C LIKE 'IOE-231%' THEN c.IT_MNGC_BG * COALESCE(c.XCR,1) ELSE 0 END AS reqRentBg,
    -- ... (동일 패턴)
    -- 조정: BBUGTM 매칭
    b.DUP_BG AS adjAmount
FROM TAAABB_BCOSTM c
LEFT JOIN TAAABB_BBUGTM b
    ON b.ORC_TB = 'BCOSTM' AND b.ORC_PK_VL = c.IT_MNGC_NO
    AND b.BG_YY = :bgYy AND b.DEL_YN = 'N'
WHERE c.BG_YY = :bgYy
  AND c.DEL_YN = 'N'
  AND c.LST_YN = 'Y'
ORDER BY c.IT_MNGC_NO
```

**참고**: 전산업무비는 레코드 1건이 1개 비목에 대응하므로 피벗 불필요. 비목코드 접두어를 확인하여 해당 컬럼에 금액 배치.

#### 경상사업 쿼리 (findOrdinaryStatus)

```sql
SELECT
    p.PRJ_MNG_NO, p.PUL_DTT, p.PRJ_NM, p.PRJ_DES,
    -- 기계장치 (GCL_DTT LIKE 'IOE-238%')
    MAX(CASE WHEN i.GCL_DTT LIKE 'IOE-238%' THEN i.CUR END) AS machCur,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-238%' THEN i.GCL_QTT ELSE 0 END) AS machQtt,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-238%' THEN i.GCL_AMT ELSE 0 END) AS machAmt,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-238%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS machAmtKrw,
    -- 기타무형자산 (GCL_DTT LIKE 'IOE-239%')
    MAX(CASE WHEN i.GCL_DTT LIKE 'IOE-239%' THEN i.CUR END) AS intanCur,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-239%' THEN i.GCL_QTT ELSE 0 END) AS intanQtt,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-239%' THEN i.GCL_AMT ELSE 0 END) AS intanAmt,
    SUM(CASE WHEN i.GCL_DTT LIKE 'IOE-239%' THEN i.GCL_AMT * COALESCE(i.XCR,1) ELSE 0 END) AS intanAmtKrw
FROM TAAABB_BPROJM p
LEFT JOIN TAAABB_BITEMM i
    ON i.PRJ_MNG_NO = p.PRJ_MNG_NO AND i.PRJ_SNO = p.PRJ_SNO
    AND i.DEL_YN = 'N' AND i.LST_YN = 'Y'
WHERE p.BG_YY = :bgYy
  AND p.ORN_YN = 'Y'
  AND p.DEL_YN = 'N'
  AND p.LST_YN = 'Y'
GROUP BY p.PRJ_MNG_NO, p.PRJ_SNO, p.PUL_DTT, p.PRJ_NM, p.PRJ_DES
ORDER BY p.PRJ_MNG_NO
```

**단가 계산**: `machUnitPrice = machAmt / machQtt` (Service에서 후계산, 0으로 나누기 방지)

### 3.6 BudgetStatusController

```java
@RestController
@RequestMapping("/api/budget/status")
@RequiredArgsConstructor
@Tag(name = "BudgetStatus", description = "예산 현황 API")
public class BudgetStatusController {

    private final BudgetStatusService budgetStatusService;

    @Operation(summary = "정보화사업 예산 현황 조회")
    @GetMapping("/projects")
    public ResponseEntity<List<BudgetStatusDto.ProjectResponse>> getProjects(
            @RequestParam("bgYy") String bgYy) {
        return ResponseEntity.ok(budgetStatusService.getProjectStatus(bgYy));
    }

    @Operation(summary = "전산업무비 예산 현황 조회")
    @GetMapping("/costs")
    public ResponseEntity<List<BudgetStatusDto.CostResponse>> getCosts(
            @RequestParam("bgYy") String bgYy) {
        return ResponseEntity.ok(budgetStatusService.getCostStatus(bgYy));
    }

    @Operation(summary = "경상사업 예산 현황 조회")
    @GetMapping("/ordinary")
    public ResponseEntity<List<BudgetStatusDto.OrdinaryResponse>> getOrdinary(
            @RequestParam("bgYy") String bgYy) {
        return ResponseEntity.ok(budgetStatusService.getOrdinaryStatus(bgYy));
    }
}
```

### 3.7 BudgetStatusService

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BudgetStatusService {

    private final BudgetStatusQueryRepository budgetStatusQueryRepository;

    public List<BudgetStatusDto.ProjectResponse> getProjectStatus(String bgYy) {
        return budgetStatusQueryRepository.findProjectStatus(bgYy);
        // 소계/합계 후계산은 QueryDSL에서 처리하거나 Service에서 후처리
    }

    public List<BudgetStatusDto.CostResponse> getCostStatus(String bgYy) {
        return budgetStatusQueryRepository.findCostStatus(bgYy);
    }

    public List<BudgetStatusDto.OrdinaryResponse> getOrdinaryStatus(String bgYy) {
        List<BudgetStatusDto.OrdinaryResponse> results =
            budgetStatusQueryRepository.findOrdinaryStatus(bgYy);
        // 단가 후계산: unitPrice = amt / qtt (qtt > 0)
        return results;
    }
}
```

---

## 4. 프론트엔드 설계

### 4.1 파일 구조

```
it_frontend/app/
├── pages/budget/
│   └── status.vue              — 예산 현황 페이지 (3탭)
├── composables/
│   └── useBudgetStatus.ts      — API 호출 composable
└── types/
    └── budgetStatus.ts         — TypeScript 타입 정의
```

### 4.2 pages/budget/status.vue 구조

```vue
<script setup lang="ts">
// 1. 연도 선택 (기본: 현재 연도)
const bgYy = ref(new Date().getFullYear().toString())

// 2. 탭 상태
const activeTab = ref(0)  // 0: 정보화사업, 1: 전산업무비, 2: 경상사업

// 3. API 호출 (탭 전환 시 lazy 로딩)
const { fetchProjectStatus, fetchCostStatus, fetchOrdinaryStatus } = useBudgetStatus()
const { data: projects } = await fetchProjectStatus(bgYy)
const { data: costs } = await fetchCostStatus(bgYy)
const { data: ordinary } = await fetchOrdinaryStatus(bgYy)

// 4. 컬럼 정의 (탭별)
const projectColumns = ref([...])
const costColumns = ref([...])
const ordinaryColumns = ref([...])

// 5. 컬럼 조정 기능
const visibleProjectCols = ref([...])  // 기본값: 전체 선택
const filteredProjectCols = computed(() =>
  projectColumns.value.filter(c => visibleProjectCols.value.includes(c.field))
)

// 6. 엑셀 다운로드
const exportExcel = () => { /* XLSX 라이브러리 사용 */ }
</script>
```

### 4.3 컬럼 정의 상세

#### 정보화사업 컬럼 (~34개)

| 그룹 | field | header | 정렬 | 너비 |
|------|-------|--------|------|------|
| **기본정보** | prjTp | 프로젝트유형 | center | 100 |
| | pulDtt | 신규/계속 | center | 80 |
| | prjNm | 사업명 | left | 200 |
| | prjDes | 사업개요 | left | 250 |
| | svnHdq | 주관부문 | center | 100 |
| | svnDpm | 주관부서 | center | 100 |
| | svnDpmTlr | 주관팀 담당팀장 | center | 100 |
| | svnDpmCgpr | 주관팀 담당자 | center | 100 |
| | itDpm | IT담당부서 | center | 100 |
| | itDpmTlr | IT담당팀장 | center | 100 |
| | itDpmCgpr | IT담당자 | center | 100 |
| | prjPulPtt | 추진가능성 | center | 80 |
| | sttDt | 시작일자 | center | 100 |
| | endDt | 종료일자 | center | 100 |
| **편성요청** | reqDevBg | 개발비 | right | 120 |
| | reqMachBg | 기계장치 | right | 120 |
| | reqIntanBg | 기타무형자산 | right | 120 |
| | reqAssetBg | **자본예산(소계)** | right | 130 |
| | reqRentBg | 전산임차료 | right | 120 |
| | reqTravelBg | 전산여비 | right | 120 |
| | reqServiceBg | 전산용역비 | right | 120 |
| | reqMiscBg | 전산제비 | right | 120 |
| | reqCostBg | **일반관리비(소계)** | right | 130 |
| | reqTotalBg | **총 사업예산(합계)** | right | 140 |
| **기타** | rprSts | 사전보고 | center | 80 |
| | edrt | 전결권 | center | 80 |
| **조정(편성)** | adjDevBg | 개발비 | right | 120 |
| | adjMachBg | 기계장치 | right | 120 |
| | adjIntanBg | 기타무형자산 | right | 120 |
| | adjAssetBg | **자본예산(소계)** | right | 130 |
| | adjRentBg | 전산임차료 | right | 120 |
| | adjTravelBg | 전산여비 | right | 120 |
| | adjServiceBg | 전산용역비 | right | 120 |
| | adjMiscBg | 전산제비 | right | 120 |
| | adjCostBg | **일반관리비(소계)** | right | 130 |
| | adjTotalBg | **총 사업예산(합계)** | right | 140 |

#### 전산업무비 컬럼 (~19개)
기본정보 9개 + 편성요청 5개 + 조정 5개 (위 API 응답 구조 참조)

#### 경상사업 컬럼 (~13개)
기본정보 3개 + 기계장치 5개 + 기타무형자산 5개 (위 API 응답 구조 참조)

### 4.4 컬럼 그룹 헤더 (ColumnGroup)

PrimeVue `ColumnGroup`으로 2단 헤더를 구성한다:

```
┌────────────┬───────────────────────────┬──────┬───────────────────────────┐
│  기본정보   │      편성요청 금액         │ 기타 │      조정(편성) 금액       │
├────────────┼───┬───┬───┬───┬───┬───┬───┼──┬───┼───┬───┬───┬───┬───┬───┬───┤
│유형│구분│...│개발│기계│무형│자본│임차│여비│용역│제비│관리│합계│보고│전결│개발│...│
```

### 4.5 컬럼 조정 기능

```vue
<!-- 컬럼 설정 버튼 + MultiSelect 패널 -->
<Button label="컬럼 설정" icon="pi pi-cog" @click="showColSettings = true" />
<Dialog v-model:visible="showColSettings" header="표시할 컬럼 선택" modal>
    <MultiSelect
        v-model="visibleProjectCols"
        :options="projectColumns"
        optionLabel="header"
        optionValue="field"
        placeholder="컬럼 선택"
        display="chip"
        :maxSelectedLabels="5"
        class="w-full"
    />
</Dialog>
```

- `visibleProjectCols`를 `localStorage`에 저장하여 세션 간 유지
- 탭별 독립적인 컬럼 설정 관리

### 4.6 고정 컬럼 및 가로 스크롤

```vue
<StyledDataTable :value="projects" scrollable scrollHeight="70vh"
    :frozenColumns="1">
    <!-- 첫 번째 컬럼(사업명)을 고정 -->
    <Column field="prjNm" header="사업명" frozen style="min-width: 200px" />
    <!-- 나머지 컬럼은 동적 렌더링 -->
    <Column v-for="col in filteredProjectCols" :key="col.field"
        :field="col.field" :header="col.header"
        :style="{ minWidth: col.width + 'px', textAlign: col.align }" />
</StyledDataTable>
```

### 4.7 금액 포맷

기존 `formatBudget` 유틸(`utils/common.ts`)을 재활용. 단위 전환(원/천원/백만원/억원) SelectButton 포함.

```vue
<SelectButton v-model="unit" :options="unitOptions" />
```

### 4.8 useBudgetStatus.ts

```typescript
export function useBudgetStatus() {
    const fetchProjectStatus = (bgYy: Ref<string>) =>
        useApiFetch<ProjectStatusItem[]>('/api/budget/status/projects', {
            query: { bgYy }
        })

    const fetchCostStatus = (bgYy: Ref<string>) =>
        useApiFetch<CostStatusItem[]>('/api/budget/status/costs', {
            query: { bgYy }
        })

    const fetchOrdinaryStatus = (bgYy: Ref<string>) =>
        useApiFetch<OrdinaryStatusItem[]>('/api/budget/status/ordinary', {
            query: { bgYy }
        })

    return { fetchProjectStatus, fetchCostStatus, fetchOrdinaryStatus }
}
```

### 4.9 types/budgetStatus.ts

```typescript
export interface ProjectStatusItem {
    prjMngNo: string
    prjTp: string
    pulDtt: string
    prjNm: string
    prjDes: string
    svnHdq: string
    svnDpm: string
    svnDpmTlr: string
    svnDpmCgpr: string
    itDpm: string
    itDpmTlr: string
    itDpmCgpr: string
    prjPulPtt: number | null
    sttDt: string
    endDt: string
    rprSts: string
    edrt: string
    // 편성요청
    reqDevBg: number
    reqMachBg: number
    reqIntanBg: number
    reqAssetBg: number
    reqRentBg: number
    reqTravelBg: number
    reqServiceBg: number
    reqMiscBg: number
    reqCostBg: number
    reqTotalBg: number
    // 조정(편성)
    adjDevBg: number | null
    adjMachBg: number | null
    adjIntanBg: number | null
    adjAssetBg: number | null
    adjRentBg: number | null
    adjTravelBg: number | null
    adjServiceBg: number | null
    adjMiscBg: number | null
    adjCostBg: number | null
    adjTotalBg: number | null
}

export interface CostStatusItem {
    itMngcNo: string
    pulDtt: string
    abusC: string
    ioeC: string
    biceDpm: string
    biceTem: string
    cttNm: string
    cttOpp: string
    infPrtYn: string
    itMngcTp: string
    reqRentBg: number
    reqTravelBg: number
    reqServiceBg: number
    reqMiscBg: number
    reqTotalBg: number
    adjRentBg: number | null
    adjTravelBg: number | null
    adjServiceBg: number | null
    adjMiscBg: number | null
    adjTotalBg: number | null
}

export interface OrdinaryStatusItem {
    prjMngNo: string
    pulDtt: string
    prjNm: string
    prjDes: string
    machCur: string | null
    machQtt: number
    machUnitPrice: number
    machAmt: number
    machAmtKrw: number
    intanCur: string | null
    intanQtt: number
    intanUnitPrice: number
    intanAmt: number
    intanAmtKrw: number
}
```

---

## 5. 사이드바 메뉴 수정

`AppSidebar.vue` (또는 해당 메뉴 구성 파일)에 예산 현황 메뉴 항목 추가:

```typescript
{
    label: '예산 현황',
    icon: 'pi pi-chart-bar',
    to: '/budget/status'
}
```

위치: 전산예산 그룹 내, 기존 '예산 목록' 아래.

---

## 6. 보안

- 기존 JWT 인증 체계 적용 (인증된 사용자만 접근)
- RBAC: 모든 인증 사용자가 예산 현황 조회 가능 (읽기 전용)
- SQL Injection: QueryDSL 파라미터 바인딩으로 방지

---

## 7. 성능 고려사항

| 항목 | 전략 |
|------|------|
| DB 쿼리 | 탭별 단일 쿼리 (N+1 방지), GROUP BY로 서버 레벨 피벗 |
| 대량 데이터 | ~200건 정보화사업 기준, 필요 시 페이지네이션 추가 |
| 프론트 렌더링 | PrimeVue DataTable 가상 스크롤(`virtualScroller`) 검토 |
| API 캐싱 | `useApiFetch`의 기본 캐싱 활용 (bgYy 변경 시 자동 재조회) |

---

## 8. 테스트 계획

### 8.1 백엔드 테스트

| 테스트 | 범위 |
|--------|------|
| BudgetStatusServiceTest | 각 탭별 Service 메서드 호출 + 결과 검증 |
| BudgetStatusControllerTest | API 엔드포인트 HTTP 상태코드 + 응답 구조 검증 |

### 8.2 프론트엔드 테스트

| 테스트 | 범위 |
|--------|------|
| 화면 조회 | 3개 탭 전환 + 데이터 표시 확인 |
| 컬럼 조정 | 컬럼 선택/해제 시 테이블 반영 확인 |
| 금액 포맷 | 단위 전환 시 표시 금액 확인 |
| 엑셀 다운로드 | 파일 생성 + 데이터 일치 확인 |

---

## 9. 에러 처리

| 상황 | 처리 |
|------|------|
| BBUGTM 데이터 없음 (편성률 미적용) | LEFT JOIN → adj* 필드 null → 프론트에서 '-' 표시 |
| 환율(XCR) null | `COALESCE(XCR, 1)` 적용 (KRW 기본) |
| 수량(QTT) 0 → 단가 계산 | `qtt > 0 ? amt / qtt : 0` 방어 코드 |
| API 오류 | useApiFetch 기본 에러 처리 (401→로그인, 500→토스트 알림) |

---

## 10. 파일 목록 요약

### 10.1 신규 파일 (8개)

| # | 파일 | 역할 |
|---|------|------|
| 1 | `it_backend/.../budget/status/controller/BudgetStatusController.java` | REST 엔드포인트 |
| 2 | `it_backend/.../budget/status/service/BudgetStatusService.java` | 비즈니스 로직 |
| 3 | `it_backend/.../budget/status/dto/BudgetStatusDto.java` | 응답 DTO |
| 4 | `it_backend/.../budget/status/repository/BudgetStatusQueryRepository.java` | QueryDSL 인터페이스 |
| 5 | `it_backend/.../budget/status/repository/BudgetStatusQueryRepositoryImpl.java` | QueryDSL 구현체 |
| 6 | `it_frontend/app/pages/budget/status.vue` | 예산 현황 페이지 |
| 7 | `it_frontend/app/composables/useBudgetStatus.ts` | API 호출 composable |
| 8 | `it_frontend/app/types/budgetStatus.ts` | TypeScript 타입 |

### 10.2 수정 파일 (1개)

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | 사이드바 메뉴 파일 | '예산 현황' 메뉴 항목 추가 |

---

## 11. Implementation Guide

### 11.1 구현 순서

| 순서 | 작업 | 의존성 |
|------|------|--------|
| 1 | BudgetStatusDto.java 생성 | 없음 |
| 2 | BudgetStatusQueryRepository 인터페이스 생성 | DTO |
| 3 | BudgetStatusQueryRepositoryImpl 구현 | Repository 인터페이스, Q클래스 |
| 4 | BudgetStatusService 생성 | Repository |
| 5 | BudgetStatusController 생성 | Service |
| 6 | types/budgetStatus.ts 생성 | 없음 |
| 7 | composables/useBudgetStatus.ts 생성 | Types |
| 8 | pages/budget/status.vue 생성 | Composable |
| 9 | 사이드바 메뉴 수정 | Page |

### 11.2 모듈 맵

| 모듈 | 파일 | 설명 |
|------|------|------|
| module-1: Backend DTO & Repository | 파일 1~3 | DTO 정의 + QueryDSL 쿼리 |
| module-2: Backend Service & Controller | 파일 4~5 | 비즈니스 로직 + REST API |
| module-3: Frontend Types & Composable | 파일 6~7 | 타입 정의 + API 호출 |
| module-4: Frontend Page & Menu | 파일 8~9 | 화면 UI + 메뉴 등록 |

### 11.3 Session Guide

| 세션 | 모듈 | 예상 작업량 | 명령어 |
|------|------|-----------|--------|
| Session 1 | module-1, module-2 | 백엔드 전체 (5파일) | `/pdca do budget-status --scope module-1,module-2` |
| Session 2 | module-3, module-4 | 프론트엔드 전체 (4파일) | `/pdca do budget-status --scope module-3,module-4` |

**권장**: 백엔드 → 프론트엔드 순서. 백엔드 완성 후 Swagger UI로 API 검증 가능.
