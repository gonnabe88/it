# Gap Analysis: table-refactoring

| 항목 | 내용 |
|------|------|
| Feature | table-refactoring |
| 분석일 | 2026-03-27 |
| Phase | Check |
| Match Rate | **100%** (수정 후) |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | DB 테이블명/컬럼명이 설계 표준(TAAABB_ 접두사, 한글 약어)과 불일치하여 유지보수성 저하 |
| **WHO** | 백엔드 개발자 (Spring Boot), DBA (Oracle 시퀀스 생성) |
| **RISK** | 파생 쿼리 메서드명 변경으로 인한 컴파일 오류, DTO JSON 키 변경 시 프론트엔드 영향 |
| **SUCCESS** | 빌드 성공 + 테스트 통과 + DTO JSON 키 유지 + BaseEntity 상속 |
| **SCOPE** | Clognh(로그인이력), Crtokm(갱신토큰) 2개 엔티티 및 관련 레이어 |

---

## 1. 분석 개요

### 분석 대상
- Design 문서: `docs/02-design/features/table-refactoring.design.md`
- 구현 코드: `it_backend/src/main/java/com/kdb/it/common/system/`

### 분석 방법
- 설계 명세와 구현 파일 직접 비교
- 빌드 실행으로 컴파일 검증 (`./gradlew clean build`)
- 테스트 실행 결과 확인

---

## 2. 초기 Gap 분석 결과 (수정 전)

| 항목 | 결과 |
|------|------|
| Match Rate | **96%** |
| Critical | 0 |
| Important | 0 |
| Minor | **3** |

### 발견된 Minor 이슈

| # | 파일 | 위치 | 내용 |
|---|------|------|------|
| M-01 | `LoginHistoryDto.java` | 행 31, 40 | `{@link LoginHistory}` → `{@link Clognh}` 미변경 |
| M-02 | `LoginHistoryDto.java` | 행 86, 88 | `@param loginHistory 변환할 LoginHistory 엔티티` → Clognh 미변경 |
| M-03 | `AuthService.java` | 행 33, 222, 273, 288, 304 | `{@link LoginHistory}`, "expiryDate 필드" 구 참조 잔존 |

---

## 3. 수정 이력

### M-01, M-02 — LoginHistoryDto.java JavaDoc 수정

```diff
- * <p>{@link LoginHistory} 엔티티의 정보를 클라이언트에 전달합니다.</p>
+ * <p>{@link Clognh} 엔티티의 정보를 클라이언트에 전달합니다.</p>

- * <p>{@link #fromEntity(LoginHistory)}: 단건 변환</p>
+ * <p>{@link #fromEntity(Clognh)}: 단건 변환</p>

- * {@link LoginHistory} 엔티티를 단건 응답 DTO로 변환하는 정적 팩토리 메서드
- * @param loginHistory 변환할 LoginHistory 엔티티
+ * {@link Clognh} 엔티티를 단건 응답 DTO로 변환하는 정적 팩토리 메서드
+ * @param clognh 변환할 Clognh 엔티티
```

### M-03 — AuthService.java JavaDoc 수정

```diff
- * <p>로그인 이력: 로그인 성공/실패, 로그아웃 시 {@link LoginHistory}에 자동 기록됩니다.</p>
+ * <p>로그인 이력: 로그인 성공/실패, 로그아웃 시 {@link Clognh}에 자동 기록됩니다.</p>

- // DB 저장 만료일 기준 만료 여부 확인 (3차 검증: expiryDate 필드)
+ // DB 저장 만료일 기준 만료 여부 확인 (3차 검증: endDtm 필드)

- * <p>{@link LoginHistory#createLoginSuccess(...)}, {@link LoginHistory#createLoginFailure(...)}, {@link LoginHistory#createLogout(...)}</p>
+ * <p>{@link Clognh#createLoginSuccess(...)}, {@link Clognh#createLoginFailure(...)}, {@link Clognh#createLogout(...)}</p>
```

---

## 4. 최종 Gap 분석 결과 (수정 후)

| 항목 | 결과 |
|------|------|
| Match Rate | **100%** |
| Critical | 0 |
| Important | 0 |
| Minor | 0 |

---

## 5. 구현 검증 항목

### FR 충족 여부

| 요구사항 | 상태 | 증거 |
|---------|------|------|
| FR-01: Clognh 엔티티 (TAAABB_CLOGNH 매핑, S_LGN_SNO 시퀀스) | ✅ 완료 | `Clognh.java` — `@SequenceGenerator(sequenceName="S_LGN_SNO")` |
| FR-02: Crtokm 엔티티 (TAAABB_CRTOKM 매핑, S_TOK_SNO 시퀀스) | ✅ 완료 | `Crtokm.java` — `@SequenceGenerator(sequenceName="S_TOK_SNO")` |
| FR-03: BaseEntity 상속 (`@SuperBuilder`) | ✅ 완료 | `extends BaseEntity` + `@SuperBuilder` 적용 |
| FR-04: DTO JSON 키 유지 (프론트엔드 무변경) | ✅ 완료 | `fromEntity()` 내 JSON 키(`loginType`, `ipAddress` 등) 보존 |
| FR-05: 파생 쿼리 메서드명 필드명 동기화 | ✅ 완료 | `LgnDtmDesc`, `LgnTpOrderBy` 등 모두 변경 |

### 빌드/테스트 결과

| 항목 | 결과 |
|------|------|
| `./gradlew clean build` | ✅ BUILD SUCCESSFUL (3m 6s) |
| `AuthServiceTest` (13개 테스트) | ✅ PASSED |
| `JwtUtilTest` | ✅ PASSED |
| `CustomPasswordEncoderTest` | ✅ PASSED |

---

## 6. 성공 기준 최종 평가

| 성공 기준 | 상태 |
|---------|------|
| Gradle 빌드 성공 | ✅ Met |
| 전체 테스트 통과 | ✅ Met |
| 엔티티 테이블/컬럼명 설계 일치 | ✅ Met |
| DTO JSON 응답 키 불변 | ✅ Met |
| BaseEntity DEL_YN·GUID 상속 | ✅ Met |
| JavaDoc 구 참조 없음 | ✅ Met (수정 완료) |

**종합 성공률: 6/6 (100%)**
