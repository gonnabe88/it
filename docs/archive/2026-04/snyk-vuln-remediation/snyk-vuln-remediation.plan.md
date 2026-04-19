# Plan: snyk-vuln-remediation

## Metadata
- **Feature**: snyk-vuln-remediation
- **Phase**: Plan
- **Created**: 2026-04-19
- **Author**: K140024(DESKTOP)
- **Snyk Project**: bebf11bf-f75c-44e2-890c-ab4b74cc2d74

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | Snyk 스캔 결과 13건 취약점 검출 (High 8건, Medium 2건, Low 3건). jackson-core 구버전 전이 의존성, spring-webmvc Directory Traversal, QueryDSL SQL Injection 위험 존재 |
| **Solution** | 의존성 버전 강제 업그레이드, Spring 패치 적용, QueryDSL 코드 감사 및 하드닝, 설정 파일 보안 강화 |
| **기능/UX 효과** | 보안 취약점 제거로 시스템 안전성 향상. 사용자 영향 없음 (내부 라이브러리 변경) |
| **핵심 가치** | 내부 임직원 3,000명의 데이터 보호 및 컴플라이언스 요건 충족 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | Snyk 정기 보안 스캔에서 High 8건 포함 총 13건 취약점 발견. 방치 시 DoS, 정보 유출, 디렉터리 탐색, SQL Injection 위험 |
| **WHO** | 백엔드 개발자 (조치 실행), 보안 담당자 (검토 및 승인) |
| **RISK** | 라이브러리 버전 업그레이드 시 호환성 깨짐 가능. Spring Boot BOM과 충돌 여부 사전 검증 필수 |
| **SUCCESS** | Snyk 재스캔 시 High 0건, Medium 0건 달성 (또는 공식 fix 부재 항목은 Accept/mitigate 처리) |
| **SCOPE** | it_backend 의존성 및 코드. 프론트엔드 무관 |

---

## 1. 취약점 현황 (13건)

### 1.1 심각도별 요약

| 심각도 | 건수 | 해당 라이브러리 |
|--------|------|----------------|
| High   | 8    | jackson-core 2.12.7 (4건), tools.jackson.core 3.0.2 (3건), spring-webmvc 7.0.1 (1건) |
| Medium | 2    | jackson-core 2.12.7 (1건), querydsl-jpa 5.0.0 (1건) |
| Low    | 3    | logback-core 1.5.22 (1건), spring-web 7.0.1 (1건), spring-webmvc 7.0.1 (1건) |

### 1.2 취약점 상세

| ID | 패키지 | 버전 | 심각도 | 제목 | Fix 가능 |
|----|--------|------|--------|------|---------|
| SNYK-JAVA-CHQOSLOGBACK-15062482 | logback-core | 1.5.22 | Low | External Initialization of Trusted Variables | No |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-10332631 | jackson-core | 2.12.7 | Medium | Information Exposure | No |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-10500754 | jackson-core | 2.12.7 | High | Stack-based Buffer Overflow | No |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-15365924 | jackson-core | 2.12.7 | High | Allocation of Resources Without Limits | No |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-15907551 | jackson-core | 2.12.7 | High | Allocation of Resources Without Limits | No |
| SNYK-JAVA-COMFASTERXMLJACKSONCORE-7569538 | jackson-core | 2.12.7 | High | Denial of Service (DoS) | No |
| SNYK-JAVA-COMQUERYDSL-8400287 | querydsl-jpa | 5.0.0 | Medium | SQL Injection | No |
| SNYK-JAVA-ORGSPRINGFRAMEWORK-15701755 | spring-web | 7.0.1 | Low | Injection | No |
| SNYK-JAVA-ORGSPRINGFRAMEWORK-15701756 | spring-webmvc | 7.0.1 | Low | Injection | No |
| SNYK-JAVA-ORGSPRINGFRAMEWORK-15701845 | spring-webmvc | 7.0.1 | High | Directory Traversal | No |
| SNYK-JAVA-TOOLSJACKSONCORE-15365915 | tools.jackson.core | 3.0.2 | High | Allocation of Resources Without Limits | No |
| SNYK-JAVA-TOOLSJACKSONCORE-15371178 | tools.jackson.core | 3.0.2 | High | Allocation of Resources Without Limits | No |
| SNYK-JAVA-TOOLSJACKSONCORE-15907550 | tools.jackson.core | 3.0.2 | High | Allocation of Resources Without Limits | No |

---

## 2. 원인 분석

### 2.1 jackson-core 2.12.7 (com.fasterxml)
- Spring Boot 4.0.1 BOM은 Jackson 3.x(`tools.jackson`)를 기본 채택
- **2.12.7은 다른 의존성(querydsl, mybatis, springdoc 등)의 전이 의존성으로 유입됨**
- 조치: `build.gradle`에서 전이 의존성 추적 후 강제 버전 업그레이드 (`resolutionStrategy` or `constraints`)

### 2.2 tools.jackson.core 3.0.2
- Spring Boot 4.0.1이 직접 관리하는 Jackson 3.x 버전
- `hasFixablePaths: false` → Snyk DB에 아직 패치 버전 등록 없음
- 조치: Spring Boot 버전 업그레이드(4.0.2+) 시 자동 해결 가능성 확인. 불가 시 Accept 처리 + 모니터링

### 2.3 querydsl-jpa 5.0.0 (SQL Injection)
- QueryDSL은 기본적으로 파라미터 바인딩을 사용하므로 대부분 안전
- **위험 패턴**: `StringTemplate`, `Expressions.stringTemplate()`, 또는 `.where()`에 문자열 직접 concatenation
- 조치: 코드베이스 전체 감사 후 위험 패턴 제거

### 2.4 spring-webmvc 7.0.1 (Directory Traversal - HIGH)
- `7.0.1`에 존재하는 정적 리소스 서빙 경로 탐색 취약점
- 조치: Spring Boot 4.0.2+ 업그레이드 확인, `mvc:resources` 경로 제한 설정 강화, `WebSecurityCustomizer` 재검토

### 2.5 spring-web/webmvc 7.0.1 (Injection - LOW)
- 다운스트림 컴포넌트 출력 주입 가능성
- 조치: 버전 업그레이드와 함께 해결 예상. Accept 처리 후 모니터링

### 2.6 logback-core 1.5.22 (LOW)
- 외부에서 신뢰 변수 초기화 가능성
- 조치: `logback.xml` 파일 권한 확인, 외부 설정 주입 경로 차단 확인

---

## 3. 조치 계획 (우선순위별)

### Phase 1 — 긴급 (HIGH 취약점, ~1주)

#### [P1-1] Spring Boot 버전 업그레이드 검토
```
현재: Spring Boot 4.0.1 (→ spring-web/webmvc 7.0.1)
목표: Spring Boot 4.0.2+ (spring-web/webmvc 7.0.2+ 포함 여부 확인)
```
- `build.gradle` `id 'org.springframework.boot' version '4.0.2'` 변경
- `./gradlew dependencies | grep spring-web` 로 버전 확인
- 빌드 및 통합 테스트 실행
- **기대 효과**: Directory Traversal(High), Injection(Low) 해결

#### [P1-2] jackson-core 2.12.7 전이 의존성 강제 업그레이드
```gradle
// build.gradle에 추가
configurations.all {
    resolutionStrategy.eachDependency { details ->
        if (details.requested.group == 'com.fasterxml.jackson.core') {
            details.useVersion '2.18.2'  // 최신 안정 버전
            details.because 'Snyk 취약점 SNYK-JAVA-COMFASTERXMLJACKSONCORE-* 대응'
        }
    }
}
```
- 전이 의존성 출처 추적: `./gradlew dependencies --configuration runtimeClasspath | grep jackson`
- 강제 업그레이드 후 호환성 테스트
- **기대 효과**: jackson-core 2.12.7 관련 High 4건 + Medium 1건 해결

#### [P1-3] Directory Traversal 즉시 설정 하드닝
Spring Boot 업그레이드가 지연될 경우 임시 완화 조치:
```java
// SecurityConfig.java — 정적 리소스 경로 명시적 제한
http.headers(headers -> headers
    .contentTypeOptions(Customizer.withDefaults())
    .frameOptions(frame -> frame.deny())
);
```
- `addResourceHandlers` 경로 패턴 검토 (와일드카드 최소화)
- 업로드 파일 서빙 경로가 `..` 포함 불가하도록 `FileService` 경로 검증 로직 추가

### Phase 2 — 중요 (MEDIUM 취약점, ~2주)

#### [P2-1] QueryDSL SQL Injection 코드 감사
감사 대상 패턴:
```java
// 위험 패턴 1: StringTemplate 직접 사용
Expressions.stringTemplate("function('REGEXP_LIKE', {0}, {1})", ...)  // 파라미터 바인딩이면 OK

// 위험 패턴 2: 문자열 직접 삽입 (금지)
query.where(Expressions.booleanTemplate("1=1 AND name = '" + userInput + "'"))
```
- `grep -r "stringTemplate\|booleanTemplate\|numberTemplate" it_backend/src/` 실행
- 발견된 패턴 검토 후 파라미터 바인딩 방식으로 수정
- **기대 효과**: SQL Injection (Medium) 위험 제거

#### [P2-2] tools.jackson.core 3.0.2 모니터링 설정
- Snyk DB에 패치 버전 등록 여부 주기적 확인
- Spring Boot 4.x 업그레이드 릴리즈 노트 모니터링
- 현재는 Accept + 모니터링 처리 (공식 fix 없음)

### Phase 3 — 모니터링 (LOW 취약점, ~1달)

#### [P3-1] logback-core 설정 강화
- `src/main/resources/logback.xml` 외부 접근 불가 확인
- `logback.configurationFile` 시스템 프로퍼티 외부 주입 차단
- Snyk Accept 처리 (Low, 실질적 공격 표면 제한적)

#### [P3-2] spring-web/webmvc Injection (Low)
- Spring Boot 업그레이드 후 자동 해결 기대
- 해결 안 될 경우 Snyk Accept 처리 + 다음 Spring 릴리즈 모니터링

---

## 4. 요구사항

### 4.1 기능 요구사항
| ID | 요구사항 | 우선순위 |
|----|----------|---------|
| REQ-01 | Spring Boot 4.0.2+ 업그레이드 및 호환성 검증 | P1 |
| REQ-02 | jackson-core 2.12.7 → 2.18.x 강제 업그레이드 | P1 |
| REQ-03 | Directory Traversal 임시 완화 및 파일 경로 검증 강화 | P1 |
| REQ-04 | QueryDSL 코드 전체 감사 및 위험 패턴 제거 | P2 |
| REQ-05 | tools.jackson.core 3.0.2 → Accept/모니터링 처리 | P2 |
| REQ-06 | logback, spring-web Injection → Accept 처리 | P3 |
| REQ-07 | 조치 완료 후 Snyk 재스캔 및 결과 보고 | P1 |

### 4.2 비기능 요구사항
- 기존 API 동작 변경 없음 (하위 호환성 유지)
- `./gradlew test` 전체 통과 필수
- 빌드 시간 증가 5% 이내

---

## 5. 성공 기준 (Success Criteria)

| 항목 | 목표 |
|------|------|
| SC-01 | Snyk 재스캔 High 취약점 0건 |
| SC-02 | Snyk 재스캔 Medium 취약점 0건 (or Accept 처리 근거 문서화) |
| SC-03 | `./gradlew test` 전체 통과 |
| SC-04 | `./gradlew bootRun` 정상 기동 |
| SC-05 | QueryDSL 코드 감사 완료 + 위험 패턴 0건 |

---

## 6. 리스크

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| Spring Boot 업그레이드 시 API 동작 변경 | 중 | 고 | 업그레이드 전 전체 테스트 실행, 단계적 적용 |
| jackson 2.18.x와 다른 의존성 충돌 | 중 | 중 | `./gradlew dependencies` 충돌 확인, exclusion 적용 |
| querydsl-jpa 패치 버전 미출시 장기화 | 고 | 중 | 코드 감사로 실질 위험 제거 후 Accept 처리 |
| tools.jackson 3.x 패치 지연 | 고 | 중 | Spring Boot 릴리즈 추적, Accept 후 모니터링 |

---

## 7. 구현 순서

```
Week 1:
  Day 1: Spring Boot 4.0.2 업그레이드 시도 → 테스트
  Day 2: jackson 강제 버전 업그레이드 → 의존성 트리 확인 → 테스트
  Day 3: FileService 경로 검증 강화 (Directory Traversal 완화)
  Day 4~5: Snyk 재스캔 → 결과 확인

Week 2:
  Day 1~3: QueryDSL 코드 전체 감사 + 위험 패턴 수정
  Day 4: logback/spring-web Accept 처리 문서화
  Day 5: 최종 Snyk 재스캔 + 보고서 작성
```
