## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 취합·결재 완료된 예산에 대해 비목별 편성률을 적용하여 최종 예산을 산출하는 기능이 없어, 수작업으로 편성 작업을 진행해야 함 |
| Solution | 예산 작업 화면을 신설하여 비목별 편성률(0~100) 입력 → 저장 시 일괄 적용 → 편성 결과 테이블 조회 기능 제공 |
| Function UX Effect | 비목별 편성률을 한 화면에서 입력하고 저장 버튼 한 번으로 전체 예산에 일괄 반영, 결과를 즉시 테이블로 확인 |
| Core Value | 예산 편성 프로세스를 시스템화하여 수작업 오류를 제거하고 편성 작업 시간을 대폭 단축 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 결재 완료된 예산 항목에 비목별 편성률을 적용하여 최종 편성예산을 산출하기 위함 |
| WHO | IT 예산 담당자 (예산 편성 권한 보유자) |
| RISK | 편성률 매칭 로직(DUP_IOE 접두어) 오류 시 잘못된 예산 산출 / CAPPLM 결재상태 판단 누락 시 미결재 건 포함 |
| SUCCESS | 편성률 입력·저장·조회 정상 동작 + BBUGTM 데이터 정확성 + 결재완료 건만 대상 필터링 |
| SCOPE | 백엔드(budget/work API 3종) + 프론트엔드(budget/work 페이지) + 신규 테이블(TAAABB_BBUGTM) |

---

# budget-work Plan — 예산 작업 화면 및 기능

## 1. 개요

### 1.1 배경 및 목적

현재 IT Portal 시스템에서는 정보화사업(BPROJM) 및 전산업무비(BCOSTM)에 대한 예산 신청·결재 프로세스가 구현되어 있으나, 결재 완료된 예산에 대해 비목별 편성률을 적용하여 최종 편성예산을 산출하는 기능이 없다.

PRD 요구사항에 따라 **예산 작업** 화면을 신설하여:
1. 비목별 편성률(0~100)을 입력하고
2. 저장 시 결재 완료된 사업의 비목별 금액에 편성률을 일괄 적용하며
3. 비목별 요청금액/편성금액/편성률을 테이블로 조회한다.

### 1.2 주요 용어

| 용어 | 설명 |
|------|------|
| 편성률 | 비목별로 적용하는 예산 반영 비율 (0~100%). 0이면 해당 비목 예산 제외, 100이면 전액 포함 |
| 편성비목 | 공통코드(CCODEM)에서 `CTT_TP = 'DUP_IOE'`인 코드값. 비목의 상위 그룹 역할 |
| 비목코드(IOE_C) | BCOSTM/BITEMM 등에 저장되는 실제 비목 코드값 |
| 편성금액 | `요청금액 × (편성률 / 100)` 으로 산출되는 최종 예산 금액 |
| 예산관리번호(BG_MNG_NO) | BBUGTM 테이블의 PK 첫 번째 컬럼. `S_BG` 시퀀스 기반 채번 |

---

## 2. 요구사항

### 2.1 기능 요구사항

| # | 요구사항 | 우선순위 | 비고 |
|---|---------|---------|------|
| F-01 | 예산년도 선택 드롭다운 제공 (사용자가 대상 연도 선택) | 필수 | |
| F-02 | 편성비목 목록 조회: CCODEM에서 `CTT_TP = 'DUP_IOE'` 코드 목록 표시 | 필수 | |
| F-03 | 각 편성비목별 편성률(0~100) 입력 필드 제공 | 필수 | 정수만 허용 |
| F-04 | 편성률 매칭 로직: 편성비목 코드ID에서 `DUP-IOE-` 제거한 접두어로 실제 비목코드(IOE_C) 매칭 | 필수 | 예: DUP-IOE-237 → 237로 시작하는 IOE_C |
| F-05 | 저장 버튼 클릭 시 결재완료 사업의 비목별 금액에 편성률 일괄 적용 → BBUGTM 레코드 생성 | 필수 | |
| F-06 | 편성 결과 테이블 표시: 비목 / 요청금액 / 편성금액 / 편성률 | 필수 | 저장 완료 후 표시 |
| F-07 | 결재완료 건만 대상: CAPPLA를 통해 CAPPLM.APF_STS = '결재완료'인 BPROJM/BCOSTM만 집계 | 필수 | |
| F-08 | 이미 편성 데이터가 있으면 UPDATE, 없으면 INSERT (Upsert) | 필수 | |

### 2.2 데이터 집계 대상

| 원본 테이블 | 금액 컬럼 | 비목코드 컬럼 | 연결 방식 |
|------------|----------|-------------|----------|
| BPROJM → BITEMM | `BITEMM.GCL_AMT` (품목금액) | BITEMM에는 비목코드 없음 → BPROJM 전체를 비목 매핑 대상으로 | CAPPLA.ORC_TB_CD = 'BPROJM' |
| BCOSTM | `BCOSTM.IT_MNGC_BG` (전산업무비예산) | `BCOSTM.IOE_C` | CAPPLA.ORC_TB_CD = 'BCOSTM' |
| BTERMM | BTERMM은 BCOSTM의 하위 → BCOSTM 금액에 포함 | BCOSTM.IOE_C 기준 | BCOSTM 통해 간접 연결 |

> **참고**: BITEMM에는 비목코드(IOE_C) 컬럼이 없다. BPROJM의 프로젝트유형(PRJ_TP)과 편성비목의 매핑 규칙을 Design 단계에서 상세 정의한다.

### 2.3 비기능 요구사항

| # | 요구사항 | 기준 |
|---|---------|------|
| NF-01 | 편성률 저장 응답시간 | 3초 이내 (1,000건 기준) |
| NF-02 | 동시 편성 방지 | 같은 예산년도에 대해 동시 저장 시 후행 요청 실패 처리 |
| NF-03 | 감사 추적 | BaseEntity 상속으로 FST_ENR_DTM/LST_CHG_DTM 자동 기록 |

---

## 3. 신규 테이블 설계

### 3.1 TAAABB_BBUGTM (예산)

| 화면 표기명 | 컬럼 | 타입 | 키 | 비고 |
|-----------|------|------|-----|------|
| 예산관리번호 | BG_MNG_NO | VARCHAR2(32) | PK | S_BG 시퀀스 |
| 예산일련번호 | BG_SNO | NUMBER(4,0) | PK | |
| 예산년도 | BG_YY | NUMBER(4,0) | | 2026 |
| 원본테이블 | ORC_TB | VARCHAR2(10) | | BPROJM, BCOSTM |
| 원본PK값 | ORC_PK_VL | VARCHAR2(32) | | |
| 원본일련번호값 | ORC_SNO_VL | NUMBER(4,0) | | |
| 비목코드 | IOE_C | VARCHAR2(100) | | |
| 편성예산 | DUP_BG | NUMBER(15,2) | | 요청금액 × 편성률/100 |
| 편성률 | DUP_RT | NUMBER(3,0) | | 0~100 |
| 삭제여부 | DEL_YN | VARCHAR2(1) | | BaseEntity |
| 최초생성시간 | FST_ENR_DTM | DATE | | BaseEntity |
| 최초생성자 | FST_ENR_USID | VARCHAR2(14) | | BaseEntity |
| GUID | GUID | VARCHAR2(38) | | BaseEntity |
| GUID진행일련번호 | GUID_PRG_SNO | NUMBER(4,0) | | BaseEntity |
| 마지막수정시간 | LST_CHG_DTM | DATE | | BaseEntity |
| 마지막수정자 | LST_CHG_USID | VARCHAR2(14) | | BaseEntity |

---

## 4. 편성률 매칭 로직 상세

```
[편성비목 공통코드 예시]
  C_ID: DUP-IOE-237         ← 코드ID
  CTT_TP: DUP_IOE           ← 코드값구분
  C_NM: 전산임차료(SW)       ← 코드명
  CDVA: 237-0700            ← 코드값(비목코드값)

[매칭 규칙]
  1. CCODEM에서 CTT_TP = 'DUP_IOE' 인 레코드 조회
  2. C_ID에서 'DUP-IOE-' 접두어 제거 → 접두어값 추출 (예: '237')
  3. TAAABB_BITEMM.GCL_DTT 또는 TAAABB_BCOSTM.IOE_C가 해당 접두어로 시작하는 레코드 매칭
     예: GCL_DTT 또는 IOE_C = '237-0700' → 접두어 '237'과 매칭

[편성금액 계산]
  편성금액(DUP_BG) = 요청금액 × (편성률(DUP_RT) / 100)
  - 요청금액: BCOSTM.IT_MNGC_BG 또는 BITEMM.GCL_AMT
  - 소수점 2자리 반올림 (ROUND HALF UP)
```

---

## 5. API 설계

### 5.1 엔드포인트 목록

| # | Method | Path | 설명 |
|---|--------|------|------|
| API-01 | GET | `/api/budget/work/ioe-categories` | 편성비목 목록 조회 (DUP_IOE 공통코드) |
| API-02 | POST | `/api/budget/work/apply` | 편성률 적용 및 BBUGTM 일괄 저장 |
| API-03 | GET | `/api/budget/work/summary` | 편성 결과 테이블 조회 (비목별 요청/편성/편성률) |

### 5.2 API 상세

#### API-01: 편성비목 목록 조회

```
GET /api/budget/work/ioe-categories?bgYy=2026

Response 200:
{
  "data": [
    {
      "cdId": "DUP-IOE-237",
      "cdNm": "전산임차료(SW)",
      "cdva": "237-0700",
      "prefix": "237",
      "dupRt": 100   // 기존 편성률 (BBUGTM에서 조회, 없으면 null)
    }
  ]
}
```

#### API-02: 편성률 적용

```
POST /api/budget/work/apply

Request Body:
{
  "bgYy": 2026,
  "rates": [
    { "cdId": "DUP-IOE-237", "dupRt": 80 },
    { "cdId": "DUP-IOE-238", "dupRt": 100 },
    { "cdId": "DUP-IOE-239", "dupRt": 0 }
  ]
}

Response 200:
{
  "message": "편성률이 적용되었습니다.",
  "totalRecords": 45,
  "summary": { ... }  // API-03과 동일 형태
}
```

#### API-03: 편성 결과 조회

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

---

## 6. 백엔드 구현 범위

### 6.1 신규 패키지 구조

```
com.kdb.it.domain.budget.work/
├── controller/
│   └── BudgetWorkController.java
├── dto/
│   └── BudgetWorkDto.java
├── entity/
│   ├── Bbugtm.java
│   └── BbugtmId.java
├── repository/
│   ├── BbugtmRepository.java
│   ├── BbugtmRepositoryCustom.java
│   └── BbugtmRepositoryImpl.java
└── service/
    └── BudgetWorkService.java
```

### 6.2 주요 구현 사항

| 항목 | 설명 |
|------|------|
| Entity | `Bbugtm extends BaseEntity`, 복합키(`BbugtmId`: BG_MNG_NO + BG_SNO) |
| 시퀀스 채번 | Oracle Native Query: `SELECT 'BG-' || ? || '-' || LPAD(S_BG.NEXTVAL, 4, '0') FROM DUAL` |
| 편성률 적용 로직 | 1) CCODEM에서 DUP_IOE 조회 2) 접두어 추출 3) 결재완료 BPROJM/BCOSTM 조회 4) 비목 매칭 5) BBUGTM Upsert |
| 결재완료 필터 | CAPPLA JOIN CAPPLM WHERE APF_STS = '결재완료' AND (ORC_TB_CD = 'BPROJM' OR 'BCOSTM') |
| 트랜잭션 | `apply` API에 `@Transactional` 적용, 일괄 저장 |

---

## 7. 프론트엔드 구현 범위

### 7.1 신규 페이지

| 파일 경로 | 설명 |
|----------|------|
| `app/pages/budget/work.vue` | 예산 작업 메인 페이지 |

### 7.2 화면 구성

```
┌──────────────────────────────────────────────────┐
│  예산 작업                                        │
├──────────────────────────────────────────────────┤
│  예산년도: [2026 ▼]                               │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ 편성비목           │ 편성률(%)               │ │
│  ├─────────────────────────────────────────────┤ │
│  │ 전산임차료(SW)      │ [  80  ]              │ │
│  │ 전산용역비          │ [ 100  ]              │ │
│  │ 전산여비            │ [  50  ]              │ │
│  │ 전산제비            │ [   0  ]              │ │
│  │ ...                │                        │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│                            [ 저장 ]               │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ [편성 결과]                                  │ │
│  │ 비목      │ 요청금액    │ 편성금액  │ 편성률 │ │
│  ├───────────┼────────────┼──────────┼────────┤ │
│  │ 전산임차  │ 150,000    │ 120,000  │  80%   │ │
│  │ 전산용역  │ 200,000    │ 200,000  │ 100%   │ │
│  │ ...       │            │          │        │ │
│  ├───────────┼────────────┼──────────┼────────┤ │
│  │ 합계      │ 500,000    │ 380,000  │   -    │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 7.3 UI 컴포넌트

| 컴포넌트 | PrimeVue | 용도 |
|----------|----------|------|
| 연도 선택 | Select | 예산년도 드롭다운 |
| 편성률 입력 | InputNumber | 0~100 범위, 정수 |
| 편성률 테이블 | DataTable | 편성비목별 입력 폼 |
| 결과 테이블 | DataTable | 비목별 요청/편성 현황 |
| 저장 버튼 | Button | severity="primary" |

### 7.4 API 연동

| 작업 | 함수 | 패턴 |
|------|------|------|
| 편성비목 조회 | `useApiFetch` | GET, 반응형 (연도 변경 시 자동 갱신) |
| 편성률 저장 | `$apiFetch` | POST, 일회성 |
| 결과 조회 | `useApiFetch` | GET, 저장 후 refresh |

---

## 8. 리스크 및 대응

| # | 리스크 | 영향 | 대응 방안 |
|---|--------|------|----------|
| R-01 | 편성비목 접두어 매칭 실패 (비목코드가 접두어로 시작하지 않는 경우) | 일부 비목 누락 | 매칭되지 않는 비목 별도 로깅 + 화면에 "미매칭 N건" 안내 |
| R-02 | BITEMM에 비목코드(IOE_C)가 없음 | 정보화사업 품목 매칭 불가 | BPROJM 단위로 프로젝트유형(PRJ_TP) 기반 편성비목 매핑 규칙 정의 필요 (Design에서 확정) |
| R-03 | 대량 데이터 일괄 저장 성능 | 응답 지연 | JPA `saveAll` 배치 + `spring.jpa.properties.hibernate.jdbc.batch_size` 설정 |
| R-04 | 동시 편성 충돌 | 데이터 정합성 | 비관적 락 또는 연도별 편성 상태 플래그로 충돌 방지 |

---

## 9. 성공 기준

| # | 기준 | 측정 방법 |
|---|------|----------|
| SC-01 | 편성비목 목록이 CCODEM(DUP_IOE) 기준으로 정확히 표시 | API 응답 검증 |
| SC-02 | 편성률 저장 시 결재완료 건만 대상으로 BBUGTM 레코드 정확히 생성 | DB 검증: BBUGTM 건수 = 결재완료 BPROJM+BCOSTM 비목 매칭 건수 |
| SC-03 | 편성금액 = 요청금액 × (편성률/100) 계산 정확성 | 샘플 데이터 10건 수동 검증 |
| SC-04 | 편성 결과 테이블에서 비목별 합계가 정확히 표시 | 화면 검증 |
| SC-05 | 기존 편성 데이터 재저장 시 UPDATE (중복 INSERT 방지) | 동일 연도 2회 저장 후 BBUGTM 레코드 수 동일 확인 |

---

## 10. 의존성

| 대상 | 상태 | 영향 |
|------|------|------|
| CAPPLM 결재 프로세스 | 운영 중 | 결재완료 상태 판단에 직접 의존 |
| CCODEM 공통코드 (DUP_IOE) | 운영 중 | 편성비목 정의에 의존 |
| BPROJM / BCOSTM 예산 데이터 | 운영 중 | 집계 원본 데이터 |
| Oracle 시퀀스 S_BG | **신규 생성 필요** | BG_MNG_NO 채번 |
