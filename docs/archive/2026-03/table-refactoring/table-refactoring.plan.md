# Plan: table-refactoring

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | table-refactoring |
| 시작일 | 2026-03-27 |
| 담당 | IT Portal System 백엔드 |

### Value Delivered

| 관점 | 내용 |
|------|------|
| Problem | LOGIN_HISTORY, REFRESH_TOKEN 테이블이 표준 네이밍 컨벤션(TAAABB_ 접두사, 약어 컬럼명)과 BaseEntity 상속 구조를 따르지 않아 시스템 통일성이 깨져 있음 |
| Solution | 두 테이블을 표준 테이블명/컬럼명으로 변경하고 BaseEntity 상속 구조를 적용하여 일관성 확보 |
| Function UX Effect | 로그인 이력 조회 API 응답 키 유지로 프론트엔드 변경 없이 백엔드만 수정 완료 |
| Core Value | 전체 시스템 엔티티 설계 통일성 확보 및 향후 유지보수 효율 향상 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 전사 IT 시스템 표준 테이블 네이밍 및 BaseEntity 상속 구조 통일을 위한 리팩토링 |
| WHO | IT Portal System 관리자 및 개발팀 (3,000명 임직원 로그인 기록 보존) |
| RISK | 기존 시퀀스 전략(IDENTITY) → SequenceGenerator 변경으로 Oracle 시퀀스 선생성 필요 |
| SUCCESS | 두 엔티티 모두 새 테이블명/컬럼명으로 정상 매핑, 기존 로그인/토큰 기능 동작 유지 |
| SCOPE | 백엔드 7개 파일 수정, 프론트엔드 변경 없음 |

---

## 1. 요구사항 (Requirements)

### 1.1 기능 요구사항

#### FR-01: LoginHistory 엔티티 리팩토링
- 테이블명 변경: `LOGIN_HISTORY` → `TAAABB_CLOGNH`
- PK 변경: `ID` (IDENTITY) → `LGN_SNO` (SequenceGenerator: `S_LGN_SNO`)
- BaseEntity 상속으로 변경 (DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID 추가)
- 컬럼 및 Java 필드 매핑 변경:

| 기존 컬럼명 | 신규 컬럼명 | 기존 필드명 | 신규 필드명 | 비고 |
|------------|------------|-----------|-----------|------|
| ID | LGN_SNO | id | lgnSno | PK, SequenceGenerator |
| ENO | ENO | eno | eno | 길이 80→32 |
| FAILURE_REASON | FLUR_RSN | failureReason | flurRsn | 길이 2000→200 |
| IP_ADDRESS | IP_ADDR | ipAddress | ipAddr | |
| LOGIN_TIME | LGN_DTM | loginTime | lgnDtm | TIMESTAMP 유지 |
| LOGIN_TYPE | LGN_TP | loginType | lgnTp | |
| USER_AGENT | UST_AGT | userAgent | ustAgt | |

#### FR-02: RefreshToken 엔티티 리팩토링
- 테이블명 변경: `REFRESH_TOKEN` → `TAAABB_CRTOKM`
- PK 변경: `ID` (IDENTITY) → `TOK_SNO` (SequenceGenerator: `S_TOK_SNO`)
- BaseEntity 상속으로 변경
- 컬럼 및 Java 필드 매핑 변경:

| 기존 컬럼명 | 신규 컬럼명 | 기존 필드명 | 신규 필드명 | 비고 |
|------------|------------|-----------|-----------|------|
| ID | TOK_SNO | id | tokSno | PK, SequenceGenerator |
| TOKEN | TOK | token | tok | UNIQUE 유지 |
| ENO | ENO | eno | eno | 길이 80 유지 |
| EXPIRY_DATE | END_DTM | expiryDate | endDtm | LocalDateTime 유지 |
| CREATED_AT | (제거) | createdAt | (제거) | BaseEntity FST_ENR_DTM으로 대체 |

#### FR-03: LoginHistoryDto.Response JSON 응답 키 유지
- `fromEntity()` 메서드만 새 getter 호출로 수정
- JSON 응답 필드명(loginType, ipAddress, loginTime, failureReason 등) 변경 없음
- 프론트엔드 변경 불필요

#### FR-04: Repository Derived Query 메서드 업데이트
- `LoginHistoryRepository`의 Spring Data JPA 쿼리 메서드명을 새 필드명에 맞게 수정

#### FR-05: AuthService RefreshToken Builder 수정
- `.expiryDate(...)` → `.endDtm(...)`
- `.createdAt(...)` 제거 (BaseEntity가 자동 관리)

### 1.2 비기능 요구사항

- 기존 로그인/토큰 발급/갱신/로그아웃 기능 정상 동작 유지
- 프론트엔드 API 인터페이스 변경 없음
- Oracle 시퀀스 `S_LGN_SNO`, `S_TOK_SNO` 선생성 필요 (DB 스크립트)

---

## 2. 변경 범위 (Scope)

### 2.1 백엔드 변경 파일 목록

| # | 파일 | 변경 유형 | 변경 내용 |
|---|------|----------|---------|
| 1 | `common/system/entity/LoginHistory.java` | 전면 수정 | 테이블명, PK, 필드명, BaseEntity 상속 |
| 2 | `common/system/entity/RefreshToken.java` | 전면 수정 | 테이블명, PK, 필드명, BaseEntity 상속 |
| 3 | `common/system/dto/LoginHistoryDto.java` | 부분 수정 | fromEntity() getter 호출 업데이트 |
| 4 | `common/system/repository/LoginHistoryRepository.java` | 부분 수정 | Derived query 메서드명 변경 |
| 5 | `common/system/service/LoginHistoryService.java` | 부분 수정 | Repository 메서드 호출 업데이트 |
| 6 | `common/system/service/AuthService.java` | 부분 수정 | RefreshToken builder 수정 |
| 7 | `it_backend/CLAUDE.md` | 부분 수정 | 테이블 매핑 주석 업데이트 |

### 2.2 DB 스크립트 (별도)

| # | 작업 | 내용 |
|---|------|------|
| 1 | 시퀀스 생성 | `CREATE SEQUENCE S_LGN_SNO` |
| 2 | 시퀀스 생성 | `CREATE SEQUENCE S_TOK_SNO` |

### 2.3 프론트엔드 변경 없음
- `it_frontend` 코드베이스 내 `login-history`, `loginType`, `ipAddress` 등 관련 코드 미사용 확인
- RefreshToken API 인터페이스(토큰 문자열) 변경 없음

---

## 3. 주요 기술 결정 사항

### 3.1 SequenceGenerator 설정
Oracle 시퀀스를 JPA에 연결하는 표준 방식:
```java
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "S_LGN_SNO")
@SequenceGenerator(name = "S_LGN_SNO", sequenceName = "S_LGN_SNO", allocationSize = 1)
@Column(name = "LGN_SNO")
private Long lgnSno;
```
- `allocationSize = 1`: Oracle 시퀀스 INCREMENT BY 값과 일치 필요

### 3.2 BaseEntity 상속 시 @SuperBuilder 적용
- 기존 `@Builder` → `@SuperBuilder` 변경 (BaseEntity가 `@SuperBuilder` 사용)
- 정적 팩토리 메서드 내부의 `.builder()` 호출 유지

### 3.3 RefreshToken.createdAt 필드 제거
- `AuthService.login()`에서 `.createdAt(LocalDateTime.now())` 빌더 호출 제거
- BaseEntity의 `@CreatedDate`(FST_ENR_DTM)가 JPA Auditing으로 자동 기록

### 3.4 LoginHistoryDto.Response: getter 이름 매핑
- DTO 필드명(id, loginType 등)은 유지하고 `fromEntity()`의 getter 호출만 변경
- 예: `.loginType(loginHistory.getLgnTp())` — JSON 키 변화 없음

---

## 4. 위험 요소 (Risks)

| 위험 | 가능성 | 영향 | 대응 |
|------|--------|------|------|
| Oracle 시퀀스 미생성 시 INSERT 실패 | 높음 | Critical | 구현 전 DB 시퀀스 생성 스크립트 실행 |
| @SuperBuilder 미적용으로 컴파일 오류 | 중간 | High | LoginHistory, RefreshToken 둘 다 @SuperBuilder 적용 확인 |
| Repository 메서드명 변경 누락으로 런타임 오류 | 낮음 | High | 전체 메서드명 체크리스트 검토 |

---

## 5. 성공 기준 (Success Criteria)

- [ ] `LoginHistory` 엔티티가 `TAAABB_CLOGNH` 테이블에 올바르게 매핑됨
- [ ] `RefreshToken` 엔티티가 `TAAABB_CRTOKM` 테이블에 올바르게 매핑됨
- [ ] 로그인 성공/실패/로그아웃 시 `TAAABB_CLOGNH`에 이력 저장됨
- [ ] 로그인 시 `TAAABB_CRTOKM`에 토큰 저장, Access Token 갱신, 로그아웃 시 삭제 정상 동작
- [ ] `GET /api/login-history` 응답 JSON 키 변화 없음 (loginType, ipAddress, loginTime, failureReason)
- [ ] 프로젝트 빌드 성공 (`./gradlew build`)
