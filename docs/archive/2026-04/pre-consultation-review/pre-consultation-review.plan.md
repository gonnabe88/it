# 사전협의 고도화 Planning Document

> **Summary**: 요구사항 정의서 상세 화면에 버전 관리 기반 협업 검토(사전협의) 기능 추가
>
> **Project**: IT Portal System
> **Version**: -
> **Author**: K140024
> **Date**: 2026-04-06
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 요구사항 정의서 검토 시 다수 검토자의 의견 수집·반영이 오프라인/메일로 이루어져 비효율적이고 이력 추적이 불가 |
| **Solution** | 문서 본문 인라인 코멘트 + 메신저형 대화창 + 버전 관리를 통한 온라인 협업 검토 시스템 |
| **Function/UX Effect** | 검토자가 본문 특정 영역을 드래그→우클릭으로 코멘트를 남기면 하이라이트+메모로 표시되고, 우측 메신저 창에서 실시간 대화 가능 |
| **Core Value** | 검토 의견의 투명한 이력 관리와 반복 검토 사이클 단축 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 다수 검토자 의견 수집이 비체계적이어서 검토 사이클이 길고 이력 추적 불가 |
| **WHO** | 작성자(요구사항 정의서 담당자) + 검토자(개발/운영팀, 계약팀, 기획팀, PMO팀) |
| **RISK** | Tiptap 에디터 신규 도입에 따른 학습곡선 및 기존 문서 데이터 호환성 |
| **SUCCESS** | ① 인라인 코멘트가 본문 하이라이트+메모로 정상 표시 ② 버전 관리(v0.1→v0.2) 동작 ③ 메신저 대화창 코멘트 연동 |
| **SCOPE** | Phase 1: 프론트엔드 UI/UX (localStorage 모의 데이터) → Phase 2: 백엔드 API 연동 (추후) |

---

## 1. Overview

### 1.1 Purpose

요구사항 정의서에 대해 여러 검토자가 온라인으로 의견을 제시하고, 작성자가 수정·재검토 요청하는 협업 검토(사전협의) 시스템을 구현한다. 현재 Phase에서는 프론트엔드 화면만 구현하며, 백엔드 API는 추후 개발한다.

### 1.2 Background

- 현재 요구사항 정의서 검토는 메일/대면으로 진행되어 의견 이력 추적이 어려움
- 검토자(4개 팀)가 각각 개별 피드백을 주면 작성자가 취합·반영하는 과정이 반복적
- Google Docs 스타일의 인라인 코멘트 + 버전 관리로 검토 효율화 필요

### 1.3 Related Documents

- PRD: `PRD_20260406.md`
- 기존 상세 페이지: `app/pages/info/documents/[id].vue`

---

## 2. Scope

### 2.1 In Scope

- [x] 사전협의 전용 페이지 (`/info/documents/[id]/review`)
- [x] Tiptap 에디터 기반 문서 뷰어/편집기
- [x] H2/H3 고정 구조 (삭제 불가, 텍스트 추가만 가능)
- [x] 검토요청 → 초안(v0.1) 등록 및 버전 관리
- [x] 본문 드래그 → 우클릭 인라인 코멘트 (텍스트 + 첨부파일)
- [x] 드래그 없이 우클릭 → 전반 코멘트
- [x] 코멘트 하이라이트 + 메모 표시
- [x] 우측 메신저형 대화창 (코멘트 연동 + 직접 입력)
- [x] 검토자별 검토완료 버튼
- [x] localStorage/Pinia 기반 모의 데이터 저장

### 2.2 Out of Scope

- 백엔드 API 개발 (추후 Phase 2)
- 실시간 동시 편집 (WebSocket/CRDT)
- 알림/메일 발송
- 권한 관리 (RBAC)
- 모바일 반응형 최적화

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 작성자가 검토요청 시 초안(v0.1)이 등록되고, 이후 수정→재검토요청 시 버전이 증가(v0.2, v0.3...) | High | Pending |
| FR-02 | Tiptap 에디터에서 사전 정의된 H2/H3 구조 텍스트는 삭제 불가, 하위 텍스트 추가/수정만 허용 | High | Pending |
| FR-03 | 직접 입력한 텍스트(H2/H3 외)는 자유롭게 수정 가능 | High | Pending |
| FR-04 | 검토자(4개 팀)가 각자 의견을 남기고 [검토완료] 버튼으로 개별 검토 완료 처리 | High | Pending |
| FR-05 | 본문 텍스트 드래그 후 우클릭 → 해당 영역에 대한 코멘트(텍스트+첨부파일) 등록 | High | Pending |
| FR-06 | 드래그 없이 우클릭 → 전반적인 내용에 대한 코멘트(텍스트+첨부파일) 등록 | High | Pending |
| FR-07 | 인라인 코멘트가 본문에 하이라이트 표시되고, 클릭 시 메모(팝오버) 형태로 내용 확인 | High | Pending |
| FR-08 | 우측 메신저형 대화창에 모든 코멘트가 시간순으로 표시 (본문 코멘트 연동) | High | Pending |
| FR-09 | 메신저 대화창에서 직접 코멘트(텍스트+첨부파일) 입력 가능 | Medium | Pending |
| FR-10 | 버전별 문서 내용 조회 (이전 버전 열람) | Medium | Pending |
| FR-11 | 코멘트 클릭 시 본문 해당 위치로 스크롤 이동 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 에디터 초기 로딩 2초 이내 | Chrome DevTools |
| UX | 코멘트 등록 후 1초 이내 하이라이트 반영 | 수동 테스트 |
| 호환성 | Chrome, Edge 최신 2개 버전 지원 | 브라우저 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 사전협의 전용 페이지에서 문서 조회 및 편집 가능
- [ ] H2/H3 고정 구조가 삭제 불가하게 동작
- [ ] 검토요청 시 버전이 증가하며 이전 버전 열람 가능
- [ ] 본문 드래그→우클릭으로 인라인 코멘트 등록 및 하이라이트 표시
- [ ] 우측 메신저 대화창에 코멘트 연동 및 직접 입력 동작
- [ ] 검토자별 검토완료 처리 가능
- [ ] localStorage/Pinia에 데이터 저장/복원 정상 동작

### 4.2 Quality Criteria

- [ ] TypeScript 엄격 모드 오류 없음
- [ ] ESLint 오류 없음
- [ ] 기존 테스트 통과 (`npm test`)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Tiptap 신규 도입으로 번들 크기 증가 및 학습곡선 | Medium | High | 필요한 Extension만 선택적 설치, 팀 내 가이드 문서 작성 |
| Quill→Tiptap 전환 시 기존 문서 HTML 호환성 이슈 | High | Medium | 기존 Quill HTML을 Tiptap에서 렌더링 테스트 후 변환 로직 추가 |
| 인라인 코멘트의 위치 추적 정확도 (텍스트 수정 시 코멘트 위치 이탈) | High | Medium | Tiptap Mark 기반 코멘트 앵커링으로 텍스트 변경에도 위치 유지 |
| localStorage 용량 제한 (5MB) | Low | Low | 첨부파일은 Base64 대신 파일명만 저장, 본문+코멘트만 저장 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `/info/documents/[id]` 페이지 | Page | 사전협의 페이지 링크 버튼 추가 |
| Tiptap 패키지 | NPM Package | 신규 설치 (@tiptap/vue-3, @tiptap/starter-kit 등) |
| Pinia store | Store | 사전협의 상태 관리용 store 신규 생성 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `/info/documents/[id].vue` | READ | 기존 상세 페이지 | 사전협의 버튼 추가만, 기존 기능 영향 없음 |
| `useDocuments` composable | READ | 문서 조회 | 그대로 사용, 변경 없음 |

### 6.3 Verification

- [ ] 기존 `[id].vue` 상세 페이지 정상 동작 확인
- [ ] 기존 문서 CRUD 기능 영향 없음 확인

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based modules, BaaS | Web apps with backend | ☑ |
| **Enterprise** | Strict layer separation | High-traffic systems | ☐ |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Nuxt 4 | Nuxt 4 | 기존 프로젝트 유지 |
| State Management | Pinia | Pinia | 기존 프로젝트 표준 |
| Rich Text Editor | Quill / Tiptap | Tiptap | 인라인 코멘트 Extension 구현이 용이, Vue3 지원 우수 |
| Styling | Tailwind CSS + PrimeVue | Tailwind CSS + PrimeVue | 기존 프로젝트 표준 |
| 데이터 저장 | localStorage + Pinia | localStorage + Pinia | 백엔드 없이 프론트 단독 동작 (Phase 1) |
| Context Menu | 커스텀 구현 / PrimeVue ContextMenu | PrimeVue ContextMenu | 기존 UI 라이브러리 활용 |

### 7.3 Clean Architecture Approach

```
it_frontend/app/
├── pages/info/documents/[id]/
│   └── review.vue                    ← 사전협의 전용 페이지
├── components/review/
│   ├── ReviewEditor.vue              ← Tiptap 에디터 래퍼
│   ├── ReviewCommentPopover.vue      ← 인라인 코멘트 팝오버
│   ├── ReviewMessenger.vue           ← 우측 메신저 대화창
│   ├── ReviewToolbar.vue             ← 검토요청/검토완료 버튼 영역
│   └── ReviewVersionHistory.vue      ← 버전 이력 표시
├── composables/
│   └── useReview.ts                  ← 사전협의 비즈니스 로직
├── stores/
│   └── review.ts                     ← Pinia store (코멘트, 버전, 검토 상태)
└── types/
    └── review.ts                     ← 타입 정의
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section
- [x] ESLint configuration
- [x] TypeScript configuration (`tsconfig.json`)
- [x] PrimeVue + Tailwind CSS 스타일 가이드

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | exists | review 관련 컴포넌트/composable 네이밍 규칙 | High |
| **Folder structure** | exists | `components/review/` 하위 구조 | High |
| **Import order** | exists | Tiptap 관련 import 규칙 | Medium |

### 8.3 NPM Packages to Install

| Package | Purpose | 
|---------|---------|
| `@tiptap/vue-3` | Tiptap Vue 3 바인딩 |
| `@tiptap/starter-kit` | 기본 Extension 번들 |
| `@tiptap/extension-highlight` | 텍스트 하이라이트 |
| `@tiptap/extension-collaboration` | 코멘트 마크 (커스텀 Extension 기반) |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`/pdca design pre-consultation-review`)
2. [ ] Tiptap 커스텀 Extension(코멘트 마크) 프로토타입
3. [ ] 구현 착수

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-06 | Initial draft | K140024 |
