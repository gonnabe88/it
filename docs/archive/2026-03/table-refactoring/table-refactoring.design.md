# Design: table-refactoring

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 전사 IT 시스템 표준 테이블 네이밍 및 BaseEntity 상속 구조 통일을 위한 리팩토링 |
| WHO | IT Portal System 관리자 및 개발팀 (3,000명 임직원 로그인 기록 보존) |
| RISK | 기존 시퀀스 전략(IDENTITY) → SequenceGenerator 변경으로 Oracle 시퀀스 선생성 필요 |
| SUCCESS | 두 엔티티 모두 새 테이블명/컬럼명으로 정상 매핑, 기존 로그인/토큰 기능 동작 유지 |
| SCOPE | 백엔드 엔티티 클래스명 포함 완전 재설계, 프론트엔드 변경 없음 |

---

## 1. 설계 개요

**선택된 설계안: Option B — 완전 재설계**

엔티티 클래스명을 테이블명 기반으로 변경 (LoginHistory → Clognh, RefreshToken → Crtokm).
DB 표준 네이밍과 Java 코드 완전 일치.

---

## 2. 엔티티 설계

### 2.1 Clognh (로그인이력, TAAABB_CLOGNH)

```java
@Entity
@Table(name = "TAAABB_CLOGNH")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Clognh extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "S_LGN_SNO")
    @SequenceGenerator(name = "S_LGN_SNO", sequenceName = "S_LGN_SNO", allocationSize = 1)
    @Column(name = "LGN_SNO")
    private Long lgnSno;

    @Column(name = "ENO", nullable = false, length = 32)
    private String eno;

    @Column(name = "LGN_TP", nullable = false, length = 80)
    private String lgnTp;

    @Column(name = "IP_ADDR", length = 200)
    private String ipAddr;

    @Column(name = "UST_AGT", length = 2000)
    private String ustAgt;

    @Column(name = "LGN_DTM", nullable = false)
    private LocalDateTime lgnDtm;

    @Column(name = "FLUR_RSN", length = 200)
    private String flurRsn;

    // 정적 팩토리 메서드
    public static Clognh createLoginSuccess(String eno, String ipAddr, String ustAgt) { ... }
    public static Clognh createLoginFailure(String eno, String ipAddr, String ustAgt, String flurRsn) { ... }
    public static Clognh createLogout(String eno, String ipAddr, String ustAgt) { ... }
}
```

**BaseEntity가 추가하는 필드:**
- `DEL_YN`, `GUID`, `GUID_PRG_SNO`, `FST_ENR_DTM`, `FST_ENR_USID`, `LST_CHG_DTM`, `LST_CHG_USID`

### 2.2 Crtokm (갱신토큰, TAAABB_CRTOKM)

```java
@Entity
@Table(name = "TAAABB_CRTOKM")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Crtokm extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "S_TOK_SNO")
    @SequenceGenerator(name = "S_TOK_SNO", sequenceName = "S_TOK_SNO", allocationSize = 1)
    @Column(name = "TOK_SNO")
    private Long tokSno;

    @Column(name = "TOK", nullable = false, unique = true, length = 2000)
    private String tok;

    @Column(name = "ENO", nullable = false, length = 80)
    private String eno;

    @Column(name = "END_DTM", nullable = false)
    private LocalDateTime endDtm;

    // CREATED_AT → BaseEntity.FST_ENR_DTM으로 대체

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(endDtm);
    }

    public void updateTok(String tok, LocalDateTime endDtm) {
        this.tok = tok;
        this.endDtm = endDtm;
    }
}
```

---

## 3. 파일별 변경 상세

### 3.1 신규 파일 (엔티티)

| 파일 | 위치 | 비고 |
|------|------|------|
| `Clognh.java` | `common/system/entity/` | LoginHistory 대체 |
| `Crtokm.java` | `common/system/entity/` | RefreshToken 대체 |

### 3.2 삭제 파일

| 파일 | 비고 |
|------|------|
| `LoginHistory.java` | Clognh로 대체 |
| `RefreshToken.java` | Crtokm으로 대체 |

### 3.3 수정 파일

| # | 파일 | 변경 내용 |
|---|------|---------|
| 1 | `LoginHistoryDto.java` | import Clognh; `fromEntity(Clognh clognh)` 파라미터 타입 변경; getter 호출 업데이트 |
| 2 | `LoginHistoryRepository.java` | `JpaRepository<Clognh, Long>`; derived query 메서드명 변경 |
| 3 | `RefreshTokenRepository.java` | `JpaRepository<Crtokm, Long>` |
| 4 | `LoginHistoryService.java` | import Clognh; repository 메서드 호출 업데이트 |
| 5 | `AuthService.java` | import Clognh/Crtokm; builder 수정 (expiryDate→endDtm, createdAt 제거); `any(Clognh.class)` |
| 6 | `AuthServiceTest.java` | import Clognh/Crtokm; builder 수정; mock 타입 변경 |
| 7 | `it_backend/CLAUDE.md` | 테이블 매핑 표 업데이트 (LoginHistory→Clognh, RefreshToken→Crtokm) |

---

## 4. 상세 변경 명세

### 4.1 LoginHistoryDto.java

```java
// 변경 전
import com.kdb.it.common.system.entity.LoginHistory;

public static Response fromEntity(LoginHistory loginHistory) {
    return Response.builder()
        .id(loginHistory.getId())
        .loginType(loginHistory.getLoginType())
        .ipAddress(loginHistory.getIpAddress())
        .userAgent(loginHistory.getUserAgent())
        .loginTime(loginHistory.getLoginTime())
        .failureReason(loginHistory.getFailureReason())
        .build();
}

// 변경 후
import com.kdb.it.common.system.entity.Clognh;

public static Response fromEntity(Clognh clognh) {
    return Response.builder()
        .id(clognh.getLgnSno())           // ← lgnSno 매핑
        .loginType(clognh.getLgnTp())     // ← JSON 키 유지
        .ipAddress(clognh.getIpAddr())    // ← JSON 키 유지
        .userAgent(clognh.getUstAgt())    // ← JSON 키 유지
        .loginTime(clognh.getLgnDtm())    // ← JSON 키 유지
        .failureReason(clognh.getFlurRsn()) // ← JSON 키 유지
        .build();
}

public static List<Response> fromEntities(List<Clognh> clognhs) { ... }
```

### 4.2 LoginHistoryRepository.java

```java
// 변경 전
public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Long> {
    List<LoginHistory> findByEnoOrderByLoginTimeDesc(String eno);
    List<LoginHistory> findByEnoAndLoginTimeBetweenOrderByLoginTimeDesc(...);
    List<LoginHistory> findByLoginTypeOrderByLoginTimeDesc(String loginType);
    List<LoginHistory> findTop50ByEnoOrderByLoginTimeDesc(String eno);
    List<LoginHistory> findTop10ByEnoOrderByLoginTimeDesc(String eno);
}

// 변경 후
public interface LoginHistoryRepository extends JpaRepository<Clognh, Long> {
    List<Clognh> findByEnoOrderByLgnDtmDesc(String eno);
    List<Clognh> findByEnoAndLgnDtmBetweenOrderByLgnDtmDesc(...);
    List<Clognh> findByLgnTpOrderByLgnDtmDesc(String lgnTp);
    List<Clognh> findTop50ByEnoOrderByLgnDtmDesc(String eno);
    List<Clognh> findTop10ByEnoOrderByLgnDtmDesc(String eno);
}
```

### 4.3 RefreshTokenRepository.java

```java
// 변경 전
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    Optional<RefreshToken> findByEno(String eno);
    void deleteByEno(String eno);
    void deleteByToken(String token);
}

// 변경 후
public interface RefreshTokenRepository extends JpaRepository<Crtokm, Long> {
    Optional<Crtokm> findByTok(String tok);     // token → tok
    Optional<Crtokm> findByEno(String eno);
    void deleteByEno(String eno);
    void deleteByTok(String tok);               // token → tok
}
```

### 4.4 AuthService.java — RefreshToken 관련

```java
// 변경 전
RefreshToken refreshToken = RefreshToken.builder()
    .token(refreshTokenValue)
    .eno(eno)
    .expiryDate(LocalDateTime.now().plusDays(7))
    .createdAt(LocalDateTime.now())
    .build();

// 변경 후
Crtokm refreshToken = Crtokm.builder()
    .tok(refreshTokenValue)          // token → tok
    .eno(eno)
    .endDtm(LocalDateTime.now().plusDays(7))  // expiryDate → endDtm
    // createdAt 제거 (BaseEntity.fstEnrDtm 자동 기록)
    .build();
```

```java
// findByToken → findByTok
Crtokm refreshToken = refreshTokenRepository.findByTok(refreshTokenValue)
    .orElseThrow(...);

// isExpired() 유지 (endDtm 참조)
```

### 4.5 AuthService.java — LoginHistory 관련

```java
// 변경 전
LoginHistory loginHistory = LoginHistory.createLoginSuccess(eno, ipAddress, userAgent);
loginHistoryRepository.save(loginHistory);

// 변경 후
Clognh loginHistory = Clognh.createLoginSuccess(eno, ipAddress, userAgent);
loginHistoryRepository.save(loginHistory);
```

---

## 5. DB 스크립트 (선행 실행 필요)

```sql
-- 로그인이력 시퀀스 생성
CREATE SEQUENCE S_LGN_SNO
  START WITH 1
  INCREMENT BY 1
  NOCACHE
  NOCYCLE;

-- 갱신토큰 시퀀스 생성
CREATE SEQUENCE S_TOK_SNO
  START WITH 1
  INCREMENT BY 1
  NOCACHE
  NOCYCLE;
```

> **중요**: 구현 전 DBA 또는 DB 스크립트로 시퀀스를 먼저 생성해야 합니다.

---

## 6. 구현 순서

```
Step 1: DB 시퀀스 생성 (S_LGN_SNO, S_TOK_SNO)
Step 2: Clognh.java 생성 (LoginHistory 대체)
Step 3: Crtokm.java 생성 (RefreshToken 대체)
Step 4: LoginHistoryDto.java 수정 (import + fromEntity 타입)
Step 5: LoginHistoryRepository.java 수정
Step 6: RefreshTokenRepository.java 수정
Step 7: LoginHistoryService.java 수정
Step 8: AuthService.java 수정
Step 9: AuthServiceTest.java 수정
Step 10: LoginHistory.java, RefreshToken.java 삭제
Step 11: CLAUDE.md 업데이트
Step 12: ./gradlew build 확인
```

---

## 7. 검증 포인트

| 항목 | 검증 방법 |
|------|---------|
| 컴파일 성공 | `./gradlew build` 오류 없음 |
| 로그인 이력 저장 | 로그인 시 TAAABB_CLOGNH에 INSERT 확인 |
| Refresh Token 저장 | 로그인 시 TAAABB_CRTOKM에 INSERT 확인 |
| Access Token 갱신 | `/api/auth/refresh` 정상 응답 |
| 로그인 이력 조회 | `GET /api/login-history` 응답 JSON 키 변화 없음 |

---

## 8. 영향 범위 요약

| 범주 | 파일 수 | 상세 |
|------|--------|------|
| 신규 생성 | 2 | Clognh.java, Crtokm.java |
| 수정 | 7 | Dto, Repository×2, Service×2, Test, CLAUDE.md |
| 삭제 | 2 | LoginHistory.java, RefreshToken.java |
| 프론트엔드 | 0 | 변경 없음 |
| **합계** | **11** | |

---

## 11. Implementation Guide

### 11.1 모듈 구성

| 모듈 | 파일 | 우선순위 |
|------|------|--------|
| M1: 엔티티 | Clognh.java, Crtokm.java | 1 (선행 필수) |
| M2: Repository | LoginHistoryRepository.java, RefreshTokenRepository.java | 2 |
| M3: DTO/Service | LoginHistoryDto.java, LoginHistoryService.java | 3 |
| M4: AuthService | AuthService.java | 4 |
| M5: 정리 | 삭제, Test, CLAUDE.md | 5 |

### 11.2 구현 주의사항

1. **@SuperBuilder 적용**: BaseEntity 상속 시 `@Builder` → `@SuperBuilder` 필수
2. **allocationSize = 1**: Oracle 시퀀스 INCREMENT BY 1과 일치
3. **IDENTITY 전략 제거**: 기존 `@GeneratedValue(strategy = GenerationType.IDENTITY)` 완전 제거
4. **createdAt 필드 제거**: AuthService builder에서 `.createdAt(...)` 라인 삭제

### 11.3 Session Guide

```
Module Map:
  M1 (엔티티) ─────→ M2 (Repository) ─→ M3 (DTO/Service) ─→ M4 (AuthService) ─→ M5 (정리)
  [신규생성]          [타입변경]          [import+getter]     [builder수정]        [삭제+테스트]

Recommended Session Plan:
  단일 세션으로 처리 가능 (총 변경량 ~200줄 수준)
  순서 준수 필수: M1 완료 후 M2 진행 (컴파일 의존성)
```
