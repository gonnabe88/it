# Completion Report: table-refactoring

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | table-refactoring |
| 시작일 | 2026-03-27 |
| 완료일 | 2026-03-27 |
| 소요 기간 | 1일 (단일 세션) |
| Match Rate | **100%** |
| 반복 횟수 | 0 (JavaDoc 수동 수정 1회) |

### 1.3 Value Delivered

| 관점 | 계획 | 실제 결과 |
|------|------|---------|
| Problem | LOGIN_HISTORY/REFRESH_TOKEN이 표준 네이밍과 불일치 | 2개 테이블 모두 TAAABB_ 표준 네이밍으로 완전 전환 |
| Solution | BaseEntity 상속 + SequenceGenerator 적용 | 신규 엔티티 Clognh·Crtokm 생성, 7개 파일 수정 완료 |
| Function UX Effect | DTO JSON 키 유지로 프론트엔드 무변경 | 로그인 이력 API 응답 형식 100% 유지, 프론트엔드 0 수정 |
| Core Value | 시스템 엔티티 설계 통일성 확보 | 모든 업무 엔티티가 BaseEntity 상속 표준 준수 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 전사 IT 시스템 표준 테이블 네이밍 및 BaseEntity 상속 구조 통일을 위한 리팩토링 |
| **WHO** | IT Portal System 관리자 및 개발팀 (3,000명 임직원 로그인 기록 보존) |
| **RISK** | 기존 시퀀스 전략(IDENTITY) → SequenceGenerator 변경으로 Oracle 시퀀스 선생성 필요 |
| **SUCCESS** | 두 엔티티 모두 새 테이블명/컬럼명으로 정상 매핑, 기존 로그인/토큰 기능 동작 유지 |
| **SCOPE** | 백엔드 7개 파일 수정, 프론트엔드 변경 없음 |

---

## 1. PDCA 사이클 요약

### 1.1 Plan
- PRD.md의 두 테이블 리팩토링 요구사항 분석
- 5개 기능 요구사항(FR-01~FR-05) 도출
- 사용자 결정 사항:
  - `endDtm` 타입: **LocalDateTime 유지** (ZonedDateTime 미채택)
  - 필드명 규칙: **컬럼명 기반 약어** (lgnSno, lgnDtm, lgnTp 등)
  - DTO JSON 키: **유지** (프론트엔드 변경 최소화)

### 1.2 Design
- 3개 설계 옵션 비교 후 **Option B (완전 재설계)** 채택
  - 클래스명도 테이블명 기반으로 변경: `LoginHistory` → `Clognh`, `RefreshToken` → `Crtokm`
  - 이유: 코드-테이블 간 1:1 매핑으로 장기 유지보수성 최우선
- 구현 모듈 순서 설계 (M1→M5)

### 1.3 Do (구현)
- 신규 파일 2개 생성, 기존 파일 7개 수정, 구 파일 2개 삭제
- `./gradlew clean build` → **BUILD SUCCESSFUL** (3m 6s)
- 전체 테스트(AuthServiceTest 13개 포함) 통과

### 1.4 Check (Gap 분석)
- 초기 Match Rate: **96%** (3개 Minor JavaDoc 이슈)
- 사용자 선택: "지금 모두 수정" → JavaDoc 수정 후 **100%** 달성

---

## 2. 구현 내역

### 2.1 생성/삭제 파일

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `entity/Clognh.java` | **신규** | LoginHistory 대체. TAAABB_CLOGNH, S_LGN_SNO 시퀀스, BaseEntity 상속 |
| `entity/Crtokm.java` | **신규** | RefreshToken 대체. TAAABB_CRTOKM, S_TOK_SNO 시퀀스, BaseEntity 상속 |
| `entity/LoginHistory.java` | **삭제** | Clognh.java로 대체 |
| `entity/RefreshToken.java` | **삭제** | Crtokm.java로 대체 |

### 2.2 수정 파일

| 파일 | 변경 내용 |
|------|---------|
| `repository/LoginHistoryRepository.java` | `JpaRepository<Clognh, Long>`, 파생 쿼리 메서드명 5개 수정 |
| `repository/RefreshTokenRepository.java` | `JpaRepository<Crtokm, Long>`, `findByToken`→`findByTok`, `deleteByToken`→`deleteByTok` |
| `dto/LoginHistoryDto.java` | `fromEntity(Clognh)`, getter 호출 7개 수정, JSON 키 보존 |
| `service/LoginHistoryService.java` | import Clognh, 메서드 호출 2개 수정 |
| `service/AuthService.java` | import Clognh/Crtokm, builder 수정, 팩토리 메서드 호출 수정 |
| `test/AuthServiceTest.java` | import Clognh/Crtokm, Mock 빌더 수정 |
| `it_backend/CLAUDE.md` | 테이블 매핑 섹션 업데이트 |

### 2.3 컬럼 매핑 변경 요약

**TAAABB_CLOGNH (Clognh)**

| 기존 | 신규 | 비고 |
|------|------|------|
| ID (IDENTITY) | LGN_SNO (S_LGN_SNO) | PK 방식 변경 |
| LOGIN_TYPE | LGN_TP | |
| IP_ADDRESS | IP_ADDR | |
| USER_AGENT | UST_AGT | |
| LOGIN_TIME | LGN_DTM | |
| FAILURE_REASON | FLUR_RSN | |
| -(없음)- | DEL_YN, GUID, FST_ENR_DTM 등 | BaseEntity 상속 추가 |

**TAAABB_CRTOKM (Crtokm)**

| 기존 | 신규 | 비고 |
|------|------|------|
| ID (IDENTITY) | TOK_SNO (S_TOK_SNO) | PK 방식 변경 |
| TOKEN | TOK | |
| EXPIRY_DATE | END_DTM | |
| CREATED_AT | (제거) | FST_ENR_DTM으로 대체 |
| -(없음)- | DEL_YN, GUID, FST_ENR_DTM 등 | BaseEntity 상속 추가 |

---

## 3. 성공 기준 최종 평가

| 성공 기준 | 상태 | 증거 |
|---------|------|------|
| Clognh → TAAABB_CLOGNH 매핑 | ✅ Met | `@Table(name = "TAAABB_CLOGNH")` |
| Crtokm → TAAABB_CRTOKM 매핑 | ✅ Met | `@Table(name = "TAAABB_CRTOKM")` |
| Oracle 시퀀스 연동 (S_LGN_SNO, S_TOK_SNO) | ✅ Met | `@SequenceGenerator` 적용 |
| BaseEntity 상속 (@SuperBuilder) | ✅ Met | `extends BaseEntity` + `@SuperBuilder` |
| DTO JSON 키 유지 | ✅ Met | `loginType`, `ipAddress`, `loginTime`, `failureReason` 불변 |
| Gradle 빌드 성공 | ✅ Met | `BUILD SUCCESSFUL in 3m 6s` |
| AuthServiceTest 통과 | ✅ Met | 13개 테스트 PASSED |
| JavaDoc 구 참조 없음 | ✅ Met | `{@link Clognh}` 으로 전량 수정 |

**종합 성공률: 8/8 (100%)**

---

## 4. 주요 결정 기록 (Decision Record)

| 결정 | 선택지 | 이유 | 결과 |
|------|--------|------|------|
| 필드명 규칙 | 컬럼명 기반 약어 | 코드-DB 1:1 대응으로 혼선 방지 | lgnSno, lgnDtm 등 컴파일 오류 없이 적용 |
| endDtm 타입 | LocalDateTime 유지 | 기존 테스트 호환성 유지 | AuthServiceTest endDtm 빌더 변경 최소화 |
| DTO JSON 키 | 유지 | 프론트엔드(Nuxt 4) 변경 비용 절감 | API 응답 형식 100% 유지 |
| 아키텍처 옵션 | Option B (완전 재설계) | 장기 유지보수성 최우선 | 클래스명도 Clognh/Crtokm으로 테이블명 일치 |
| createdAt 처리 | 제거 | BaseEntity.fstEnrDtm(JPA Auditing)으로 대체 | AuthService builder에서 `.createdAt()` 제거 |

---

## 5. 학습 포인트

### 기술적 학습
1. **Spring Data JPA 파생 쿼리 메서드는 Java 필드명 기반**: DB 컬럼명 변경만으로는 부족하며, Java 엔티티 필드명이 메서드명에 직접 반영됨. `findByEnoOrderByLoginTimeDesc` → `findByEnoOrderByLgnDtmDesc` 패턴.
2. **@SuperBuilder vs @Builder**: BaseEntity(`@MappedSuperclass`)를 상속하는 엔티티는 반드시 `@SuperBuilder` 사용. `@Builder`와 혼용 시 컴파일 오류 발생.
3. **Gradle 캐시 주의**: `./gradlew build`가 UP-TO-DATE를 반환할 경우 `./gradlew clean build`로 강제 재컴파일 필요.

### 프로세스 학습
1. **Option B 선택 시 파급 범위**: 클래스명 변경은 import, test, DTO 등 전체 레이어에 영향. 사전 범위 파악이 중요.
2. **JavaDoc은 Minor이지만 관리 필요**: `{@link OldClass}` 잔존 시 IDE에서 컴파일 경고 발생 가능. 리팩토링 완료 후 일괄 검토 권장.

---

## 6. 후속 작업 (Optional)

| 항목 | 우선순위 | 내용 |
|------|---------|------|
| DB 시퀀스 생성 스크립트 실행 | 필수 (운영 배포 전) | `CREATE SEQUENCE S_LGN_SNO START WITH 1 INCREMENT BY 1 NOCACHE;` |
| 통합 테스트 (실DB) | 권장 | Oracle XEPDB1 연결 후 로그인/토큰 흐름 E2E 테스트 |
| Flyway/Liquibase 마이그레이션 스크립트 | 선택 | 기존 데이터 마이그레이션 필요 시 |
