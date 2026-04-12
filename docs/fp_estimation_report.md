# 정통법(Detailed FP) 기능점수 산정 결과 보고서

## 1. 개요
- **시스템:** IT Portal System (it_frontend, it_backend)
- **산정 방식:** 정통법 (Detailed Function Point)

## 2. 데이터 기능 (ILF) 산정 상세
| 엔티티명 | RET | DET | 복잡도 | 기능점수(FP) |
|----------|-----|-----|--------|--------------|
| Bprojm | 1 | 43 | Low | 7 |
| Bcostm | 1 | 28 | Low | 7 |
| Btermm | 1 | 26 | Low | 7 |
| Bitemm | 1 | 24 | Low | 7 |
| CuserI | 1 | 23 | Low | 7 |
| Bpovwm | 1 | 19 | Low | 7 |
| Bperfm | 1 | 18 | Low | 7 |
| Ccodem | 1 | 16 | Low | 7 |
| Bbugtm | 1 | 16 | Low | 7 |
| Cdecim | 1 | 15 | Low | 7 |
| Basctm | 1 | 15 | Low | 7 |
| Capplm | 1 | 14 | Low | 7 |
| Clognh | 1 | 14 | Low | 7 |
| Bplanm | 1 | 14 | Low | 7 |
| Bpqnam | 1 | 14 | Low | 7 |
| BaseEntity | 1 | 14 | Low | 7 |
| Cfilem | 1 | 14 | Low | 7 |
| CorgnI | 1 | 13 | Low | 7 |
| Brdocm | 1 | 13 | Low | 7 |
| Cappla | 1 | 12 | Low | 7 |
| Bevalm | 1 | 12 | Low | 7 |
| Bschdm | 1 | 12 | Low | 7 |
| CauthI | 1 | 11 | Low | 7 |
| Crtokm | 1 | 11 | Low | 7 |
| Bchklc | 1 | 11 | Low | 7 |
| Brsltm | 1 | 11 | Low | 7 |
| Bgdocm | 1 | 10 | Low | 7 |
| Bcmmtm | 1 | 10 | Low | 7 |
| CroleI | 2 | 9 | Low | 7 |
| Bproja | 1 | 9 | Low | 7 |
**데이터 기능 총점(ILF + EIF):** 210 FP

## 3. 트랜잭션 기능 (EI, EO, EQ) 산정 요약
각 컨트롤러의 API 엔드포인트를 기준으로 트랜잭션 기능을 식별하였습니다. (평균 복잡도 Low 적용 기준)
- **외부입력 (EI):** 65개 (예상 FP: 195)
- **외부조회/출력 (EQ/EO):** 48개 (예상 FP: 144)
**트랜잭션 기능 총점:** 339 FP

## 4. 최종 개발 비용 산정
- **미조정 기능점수(UFP):** 549 FP
- **보정계수(VAF):** 1.00 (기본)
- **보정 후 기능점수:** 549 FP
- **FP당 단가:** ₩553,100 (정보처리학회/SW산업협회 참고단가)
- **총 개발비용 (이윤 및 부가세 포함):** ₩334,017,090

> [!NOTE]
> 본 산정 결과는 백엔드 소스코드(Entity, Controller)를 기반으로 정통법 산정 기준을 시뮬레이션한 수치입니다. 화면 UI 복잡도 및 외부 인터페이스(EIF) 세부 사항에 따라 실제 산정 시 가감이 발생할 수 있습니다.
