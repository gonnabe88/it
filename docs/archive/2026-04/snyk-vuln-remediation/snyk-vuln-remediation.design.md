# Design: snyk-vuln-remediation

## Metadata
- **Feature**: snyk-vuln-remediation
- **Phase**: Design
- **Architecture**: Option C — 실용적 균형
- **Created**: 2026-04-19
- **Author**: K140024(DESKTOP)

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | Snyk 스캔 High 8건 포함 13건 취약점. 방치 시 DoS, 디렉터리 탐색, SQL Injection 위험 |
| **WHO** | 백엔드 개발자 (조치), 보안 담당자 (검토) |
| **RISK** | Spring Boot 업그레이드 호환성 → 기존 테스트 스위트로 검증 가능 |
| **SUCCESS** | High 0건, Medium 0건 (fix 없는 항목은 Accept 처리 문서화) |
| **SCOPE** | it_backend: build.gradle, FileService.java, SecurityConfig.java |

---

## 1. 코드 감사 결과 (설계 입력)

### 1.1 QueryDSL SQL Injection — 라이브러리 업그레이드 + 코드 안전 확인

**신규**: `querydsl-jpa 5.1.0` 패치 버전 존재 → 버전 업으로 라이브러리 취약점 자체 해소

`BudgetStatusQueryRepositoryImpl.java` 내 `stringTemplate`/`numberTemplate` 사용:
```java
// 모두 {0}, {1} 파라미터 바인딩 방식 — 사용자 입력 직접 삽입 없음 (안전)
StringExpression svnDpmTlrNm = Expressions.stringTemplate(
    "(SELECT u.usrNm FROM CuserI u WHERE u.eno = {0})", p.svnDpmTlr);  // QEntity 참조
NumberExpression<BigDecimal> reqTotal = Expressions.numberTemplate(
    BigDecimal.class, "NVL({0}, 0)", i.gclAmt);                         // QEntity 참조
```
**판정**: 코드 자체는 안전(파라미터 바인딩). 추가로 `querydsl-jpa 5.1.0`으로 업그레이드하여 라이브러리 취약점도 해소. → **버전 업 해결 (Accept 불필요)**

### 1.2 FileService Directory Traversal — 보완 필요

```java
// FileService.java:455 — 현재 코드 (취약)
Path filePath = Paths.get(cfilem.getFlKpnPth()).resolve(cfilem.getSvrFlNm());
// DB 값을 그대로 경로로 사용. normalize() 없음 → basePath 탈출 가능성 존재
```

**조치 필요**: DB에 저장된 경로가 변조되었을 경우 `../` 탈출 가능. `normalize()` + `startsWith(basePath)` 검증 추가 필요.

### 1.3 SecurityConfig 보안 헤더 — 미설정

현재 `SecurityConfig.java`에 HTTP 보안 헤더 명시적 설정 없음:
- HSTS(`Strict-Transport-Security`) 미설정
- `X-Content-Type-Options: nosniff` 미확인
- `X-Frame-Options: DENY` 미확인

Spring Security 기본값으로 일부 적용되지만, 명시적 하드닝 권장.

---

## 2. 선택 아키텍처: Option C 상세 설계

### 2.1 변경 파일 목록

| 파일 | 변경 유형 | 변경 이유 |
|------|-----------|-----------|
| `build.gradle` | 수정 | Spring Boot 패치 업그레이드 + jackson 2.x 강제 업그레이드 + querydsl 5.1.0 + tools.jackson 3.1.2 강제 + logback 1.5.32 강제 |
| `FileService.java` | 수정 | 경로 정규화 + basePath 탈출 방지 |
| `SecurityConfig.java` | 수정 | HTTP 보안 헤더 명시적 설정 |
| `docs/security/snyk-accept.md` | 신규 | Accept 처리 근거 문서 (잔여 항목만) |

---

## 3. 구현 상세

### 3.1 build.gradle — 의존성 보안 패치

#### 3.1.1 Spring Boot 버전 업그레이드 + spring-webmvc 7.0.6 강제

`spring-webmvc 7.0.6`이 안전 버전으로 확인됨 → 2가지 방법 병행:

**방법 A — Spring Boot 버전 업그레이드** (BOM이 7.0.6 포함 시 자동 해결):
```gradle
// plugins 블록에서 변경
id 'org.springframework.boot' version '4.0.6'  // spring-webmvc 7.0.6 포함 버전
```

**방법 B — resolutionStrategy 강제** (Spring Boot BOM이 7.0.6 미포함 시 fallback, §3.1.3에 추가):
```gradle
if (details.requested.group == 'org.springframework') {
    details.useVersion '7.0.6'
    details.because 'Snyk SNYK-JAVA-ORGSPRINGFRAMEWORK-* 취약점 대응 (spring-webmvc 7.0.6 안전 버전)'
}
```

**확인 명령어:**
```bash
# Spring Boot 업그레이드 후 spring-webmvc 버전이 7.0.6인지 확인
./gradlew dependencies --configuration runtimeClasspath | grep "spring-webmvc"
# 기대값: org.springframework:spring-webmvc:7.0.6
```

**기대 효과:**
- SNYK-JAVA-ORGSPRINGFRAMEWORK-15701845 (High: Directory Traversal) ✅
- SNYK-JAVA-ORGSPRINGFRAMEWORK-15701755 (Low: Injection, spring-web) ✅
- SNYK-JAVA-ORGSPRINGFRAMEWORK-15701756 (Low: Injection, spring-webmvc) ✅

#### 3.1.2 querydsl-jpa 5.0.0 → 5.1.0 업그레이드

`build.gradle` `dependencies` 블록에서 직접 버전 변경:

```gradle
// 변경 전
implementation 'com.querydsl:querydsl-jpa:5.0.0:jakarta'
annotationProcessor 'com.querydsl:querydsl-apt:5.0.0:jakarta'

// 변경 후
implementation 'com.querydsl:querydsl-jpa:5.1.0:jakarta'
annotationProcessor 'com.querydsl:querydsl-apt:5.1.0:jakarta'
```

**기대 효과:**
- SNYK-JAVA-COMQUERYDSL-8400287 (Medium: SQL Injection) ✅

#### 3.1.3 의존성 강제 버전 업그레이드 (resolutionStrategy)

전이 의존성으로 유입되는 구버전들을 일괄 강제 업그레이드. `dependencies` 블록 바로 위에 추가:

```gradle
configurations.all {
    resolutionStrategy.eachDependency { DependencyResolveDetails details ->
        // com.fasterxml.jackson 2.12.7 → 2.18.2 (전이 의존성 구버전 대응)
        if (details.requested.group == 'com.fasterxml.jackson.core') {
            details.useVersion '2.18.2'
            details.because 'Snyk SNYK-JAVA-COMFASTERXMLJACKSONCORE-* High/Medium 취약점 대응'
        }
        // tools.jackson 3.0.2 → 3.1.2 (Spring Boot BOM 관리 버전 패치)
        if (details.requested.group == 'tools.jackson.core') {
            details.useVersion '3.1.2'
            details.because 'Snyk SNYK-JAVA-TOOLSJACKSONCORE-* High 취약점 대응'
        }
        // logback 1.5.22 → 1.5.32 (Low 취약점 대응)
        if (details.requested.group == 'ch.qos.logback') {
            details.useVersion '1.5.32'
            details.because 'Snyk SNYK-JAVA-CHQOSLOGBACK-15062482 Low 취약점 대응'
        }
        // spring-web/webmvc 7.0.1 → 7.0.6 (Spring Boot 업그레이드로 미해결 시 fallback)
        if (details.requested.group == 'org.springframework') {
            details.useVersion '7.0.6'
            details.because 'Snyk SNYK-JAVA-ORGSPRINGFRAMEWORK-* 취약점 대응 (7.0.6 안전 버전)'
        }
    }
}
```

**기대 효과:**

| 라이브러리 | 변경 | 해결되는 취약점 |
|-----------|------|----------------|
| `com.fasterxml.jackson.core` 2.12.7→2.18.2 | 강제 업그레이드 | High 4건 + Medium 1건 ✅ |
| `tools.jackson.core` 3.0.2→3.1.2 | 강제 업그레이드 | High 3건 ✅ |
| `ch.qos.logback` 1.5.22→1.5.32 | 강제 업그레이드 | Low 1건 ✅ |
| `org.springframework` 7.0.1→7.0.6 | 강제 업그레이드 | High 1건 + Low 2건 ✅ |

> `org.springframework` 강제 버전 적용 시 Spring Boot BOM이 관리하는 모든 spring-* 모듈에 영향.
> Spring Boot 업그레이드만으로 7.0.6이 적용된다면 이 항목은 제거해도 됨.
> `./gradlew dependencies`로 실제 적용 버전 확인 후 불필요 시 삭제.

---

### 3.2 FileService.java — 경로 탈출 방지

#### 변경 대상: `downloadFile()` 메서드 (Line 449~473)

**현재 코드 (취약):**
```java
Path filePath = Paths.get(cfilem.getFlKpnPth()).resolve(cfilem.getSvrFlNm());
```

**변경 후 코드 (안전):**
```java
public FileDownloadResult downloadFile(String flMngNo) {
    Cfilem cfilem = fileRepository.findByFlMngNoAndDelYn(flMngNo, "N")
            .orElseThrow(() -> new CustomGeneralException("존재하지 않는 파일입니다. 파일관리번호: " + flMngNo));

    Path base = Paths.get(basePath).normalize().toAbsolutePath();
    Path filePath = Paths.get(cfilem.getFlKpnPth())
            .resolve(cfilem.getSvrFlNm())
            .normalize()
            .toAbsolutePath();

    // basePath 탈출 방지 (Directory Traversal 대응)
    if (!filePath.startsWith(base)) {
        throw new CustomGeneralException("허용되지 않는 파일 경로입니다.");
    }

    Resource resource;
    try {
        resource = new UrlResource(filePath.toUri());
    } catch (MalformedURLException e) {
        throw new CustomGeneralException("파일 경로가 잘못되었습니다. 파일관리번호: " + flMngNo);
    }
    // ... 이하 동일
}
```

**동일한 패턴을 preview 메서드에도 적용** (파일 서빙 엔드포인트 전체 일관성).

---

### 3.3 SecurityConfig.java — HTTP 보안 헤더

#### 변경 대상: `filterChain()` 메서드

`http` 빌더에 `.headers()` 설정 추가:

```java
.headers(headers -> headers
    // MIME 스니핑 방지: 브라우저가 Content-Type을 변경하지 않도록 강제
    .contentTypeOptions(Customizer.withDefaults())
    // 클릭재킹 방지: iframe 삽입 금지
    .frameOptions(frame -> frame.deny())
    // HSTS: HTTPS 강제 (운영 환경 대비)
    .httpStrictTransportSecurity(hsts -> hsts
        .includeSubDomains(true)
        .maxAgeInSeconds(31536000))
)
```

**추가 위치**: `.csrf(...)` 이후, `.sessionManagement(...)` 이전

---

### 3.4 Snyk Accept 처리 문서 — 해당 없음

**13건 전부 버전 업그레이드로 해결 가능. Accept 처리 항목 없음.**

| 라이브러리 | 이전 설계 | 현재 설계 |
|-----------|-----------|-----------|
| `tools.jackson.core` 3건 | Accept | `3.1.2` 강제 → 해결 |
| `querydsl-jpa` 1건 | Accept | `5.1.0` 업그레이드 → 해결 |
| `logback-core` 1건 | Accept | `1.5.32` 강제 → 해결 |
| `spring-web/webmvc` 3건 | Accept (조건부) | `7.0.6` 강제 → 해결 |

`docs/security/snyk-accept.md`는 생성하지 않음. (필요 시 향후 신규 취약점 발생 시 작성)

---

## 4. API/데이터 변경 없음

이번 조치는 순수 보안 하드닝. API 엔드포인트, 응답 형식, DB 스키마 변경 없음.
기존 클라이언트(프론트엔드) 코드 변경 불필요.

---

## 5. 테스트 계획

### 5.1 빌드 검증
```bash
# jackson 2.12.7 미존재, 2.18.2 적용 확인
./gradlew dependencies --configuration runtimeClasspath | grep "fasterxml.jackson"

# tools.jackson 3.1.2 적용 확인
./gradlew dependencies --configuration runtimeClasspath | grep "tools.jackson"

# querydsl 5.1.0 적용 확인
./gradlew dependencies --configuration runtimeClasspath | grep "querydsl"

# logback 1.5.32 적용 확인
./gradlew dependencies --configuration runtimeClasspath | grep "logback"

# spring-webmvc 버전 확인
./gradlew dependencies --configuration runtimeClasspath | grep "spring-webmvc"

# 전체 빌드
./gradlew clean build
```

### 5.2 테스트 실행
```bash
# 전체 테스트 (기존 테스트로 호환성 검증)
./gradlew test
```

### 5.3 서버 기동 확인
```bash
./gradlew bootRun
# 기동 후 http://localhost:8080/swagger-ui/index.html 접속 확인
```

### 5.4 경로 탈출 방지 수동 테스트
```bash
# Directory Traversal 시도 — 400/500 응답 확인 (정상 파일 ID 사용 불가)
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8080/api/files/FL_00000001/download"
```

### 5.5 보안 헤더 확인
```bash
# 응답 헤더에서 보안 헤더 존재 확인
curl -I http://localhost:8080/api/auth/login
# 기대값:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## 6. 구현 가이드 (Session Guide)

### Module Map

| 모듈 | 파일 | 예상 시간 |
|------|------|----------|
| M1: 의존성 패치 | `build.gradle` | 40분 (querydsl + jackson + logback + Spring Boot) |
| M2: 파일 경로 검증 | `FileService.java` | 30분 |
| M3: 보안 헤더 | `SecurityConfig.java` | 20분 |
| M4: Accept 문서 | `docs/security/snyk-accept.md` | 10분 (잔여 2건만) |
| M5: 검증 | 빌드+테스트+헤더+의존성 트리 확인 | 30분 |

### 권장 세션 계획

```
단일 세션 (총 ~2시간):
  /pdca do snyk-vuln-remediation --scope M1  → 의존성 패치 + 빌드 확인
  /pdca do snyk-vuln-remediation --scope M2  → FileService 경로 검증
  /pdca do snyk-vuln-remediation --scope M3  → SecurityConfig 헤더
  /pdca do snyk-vuln-remediation --scope M4  → Accept 문서
  /pdca do snyk-vuln-remediation --scope M5  → 최종 검증
```

---

## 7. 성공 기준 매핑

| SC | 기준 | 이번 설계에서 달성 방법 |
|----|------|----------------------|
| SC-01 | High 0건 | jackson 2.x 강제(4건) + tools.jackson 3.1.2 강제(3건) + Spring Boot 업그레이드(1건) |
| SC-02 | Medium 0건 or Accept | jackson 2.x 업그레이드(1건) + querydsl 5.1.0 업그레이드(1건) → **Accept 불필요** |
| SC-03 | `./gradlew test` 통과 | M5 검증 단계 |
| SC-04 | `bootRun` 정상 기동 | M5 검증 단계 |
| SC-05 | QueryDSL 위험 패턴 0건 | 코드 감사 완료 (파라미터 바인딩 방식) + 5.1.0 업그레이드 |

### 취약점 해결 예상 매핑 (업데이트)

| Snyk ID | 심각도 | 해결 방법 |
|---------|--------|----------|
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-10500754 | High | jackson 2.18.2 강제 ✅ |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-15365924 | High | jackson 2.18.2 강제 ✅ |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-15907551 | High | jackson 2.18.2 강제 ✅ |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-7569538  | High | jackson 2.18.2 강제 ✅ |
| SNYK-JAVA-ORGSPRINGFRAMEWORK-15701845      | High | Spring Boot 업그레이드 ✅ |
| SNYK-JAVA-TOOLSJACKSONCORE-15365915        | High | tools.jackson 3.1.2 강제 ✅ |
| SNYK-JAVA-TOOLSJACKSONCORE-15371178        | High | tools.jackson 3.1.2 강제 ✅ |
| SNYK-JAVA-TOOLSJACKSONCORE-15907550        | High | tools.jackson 3.1.2 강제 ✅ |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-10332631 | Medium | jackson 2.18.2 강제 ✅ |
| SNYK-JAVA-COMQUERYDSL-8400287              | Medium | querydsl-jpa 5.1.0 업그레이드 ✅ |
| SNYK-JAVA-CHQOSLOGBACK-15062482            | Low | logback 1.5.32 강제 ✅ |
| SNYK-JAVA-ORGSPRINGFRAMEWORK-15701755      | Low | spring 7.0.6 강제 ✅ |
| SNYK-JAVA-ORGSPRINGFRAMEWORK-15701756      | Low | spring 7.0.6 강제 ✅ |

**13건 전부 버전 업그레이드로 해결. Accept 처리 0건.**
