# 사전협의 고도화 Design Document

> **Summary**: 요구사항 정의서 상세 화면에 버전 관리 기반 협업 검토(사전협의) 기능 추가
>
> **Project**: IT Portal System
> **Author**: K140024
> **Date**: 2026-04-06
> **Status**: Draft
> **Planning Doc**: [pre-consultation-review.plan.md](../01-plan/features/pre-consultation-review.plan.md)

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 다수 검토자 의견 수집이 비체계적이어서 검토 사이클이 길고 이력 추적 불가 |
| **WHO** | 작성자(요구사항 정의서 담당자) + 검토자(개발/운영팀, 계약팀, 기획팀, PMO팀) |
| **RISK** | Tiptap 에디터 신규 도입에 따른 학습곡선 및 기존 문서 데이터 호환성 |
| **SUCCESS** | ① 인라인 코멘트가 본문 하이라이트+메모로 정상 표시 ② 버전 관리(v0.1→v0.2) 동작 ③ 메신저 대화창 코멘트 연동 |
| **SCOPE** | Phase 1: 프론트엔드 UI/UX (localStorage 모의 데이터) → Phase 2: 백엔드 API 연동 (추후) |

---

## 1. Overview

### 1.1 Design Goals

- Tiptap 에디터 기반의 인라인 코멘트 시스템을 구현하여 Google Docs 스타일의 협업 검토 경험 제공
- 컴포넌트 간 명확한 책임 분리로 유지보수성 확보
- localStorage + Pinia 기반 모의 데이터로 백엔드 없이 완전한 UX 동작
- 추후 백엔드 API 연동 시 composable 내부만 교체하면 되는 구조

### 1.2 Design Principles

- **Single Responsibility**: 각 컴포넌트는 하나의 역할만 담당 (에디터, 코멘트, 메신저, 툴바, 버전)
- **Store-Driven State**: 모든 상태는 Pinia store에서 관리, 컴포넌트는 store를 구독
- **Graceful Degradation**: localStorage 저장 실패 시에도 세션 내 동작 유지

---

## 2. Architecture Options (v1.7.0)

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | 페이지에 로직 집중 | 최대 분리, 모듈화 | 적절한 분리, 균형 |
| **New Files** | 3 | 14 | 9 |
| **Modified Files** | 1 | 1 | 1 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Low | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | Medium (거대 파일) | Low (과설계) | Low (균형) |
| **Recommendation** | 프로토타입 | 장기 프로젝트 | **Default choice** |

**Selected**: Option C — Pragmatic Balance — **Rationale**: 5개 컴포넌트로 적절히 분리하되 과도한 추상화 없이 빠르게 구현 가능. 추후 백엔드 연동 시 composable만 교체.

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  review.vue (Page — Layout Orchestrator)                        │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │  ReviewToolbar            │  │  ReviewVersionHistory        │ │
│  │  [검토요청] [검토완료]     │  │  v0.1 → v0.2 → v0.3        │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────┐  ┌────────────────────────┐  │
│  │  ReviewEditor (Tiptap)        │  │  ReviewMessenger       │  │
│  │                               │  │                        │  │
│  │  ┌─────────────────────┐      │  │  💬 [코멘트 목록]      │  │
│  │  │ H2 고정구조 (삭제불가)│      │  │  ┌──────────────┐    │  │
│  │  │   사용자 입력 텍스트  │      │  │  │ 검토자A: ...  │    │  │
│  │  │   [하이라이트 코멘트] │◄────►│  │  │ 검토자B: ...  │    │  │
│  │  │ H3 고정구조          │      │  │  └──────────────┘    │  │
│  │  │   사용자 입력 텍스트  │      │  │                        │  │
│  │  └─────────────────────┘      │  │  ┌──────────────────┐  │  │
│  │                               │  │  │ 메시지 입력 + 📎 │  │  │
│  │  ┌─────────────────────┐      │  │  └──────────────────┘  │  │
│  │  │ ReviewCommentPopover │      │  │                        │  │
│  │  │ (우클릭 시 표시)      │      │  │                        │  │
│  │  └─────────────────────┘      │  │                        │  │
│  └───────────────────────────────┘  └────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Pinia Store (review.ts) + useReview composable          │   │
│  │  ← localStorage 영속화                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
사용자 동작 → 컴포넌트 이벤트 → useReview composable → Pinia store → localStorage 저장
                                                          ↓
                                                    컴포넌트 반응형 업데이트
```

**코멘트 등록 플로우:**
```
본문 드래그 → 우클릭 → ContextMenu → ReviewCommentPopover 열림
→ 코멘트 입력 + 첨부 → store.addComment(commentData)
→ Tiptap Mark 적용 (하이라이트) + 메신저 목록 업데이트
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| review.vue | ReviewEditor, ReviewMessenger, ReviewToolbar, ReviewVersionHistory | 레이아웃 조합 |
| ReviewEditor | Tiptap (@tiptap/vue-3), ReviewCommentPopover, useReview | 에디터 렌더링 + 코멘트 마크 |
| ReviewMessenger | useReview (store) | 코멘트 목록 표시 + 입력 |
| ReviewToolbar | useReview (store) | 검토요청/검토완료 액션 |
| ReviewVersionHistory | useReview (store) | 버전 목록 표시 |
| useReview | stores/review.ts | 비즈니스 로직 래핑 |
| stores/review.ts | localStorage | 데이터 영속화 |

---

## 3. Data Model

### 3.1 Entity Definition

```typescript
// types/review.ts

/** 검토 문서 버전 */
interface ReviewVersion {
  version: string;           // "0.1", "0.2" 등
  content: string;           // Tiptap JSON 또는 HTML
  createdAt: string;         // ISO 8601
  createdBy: string;         // 작성자 사번(eno)
}

/** 검토자 팀 유형 */
type ReviewerTeam = '개발/운영팀' | '계약팀' | '기획팀' | 'PMO팀';

/** 검토자 정보 */
interface Reviewer {
  eno: string;               // 사번
  empNm: string;             // 이름
  team: ReviewerTeam;        // 소속 팀
  status: 'pending' | 'completed';  // 검토 상태
  completedAt?: string;      // 검토 완료 시각
}

/** 코멘트 (인라인 + 전반) */
interface ReviewComment {
  id: string;                // UUID
  type: 'inline' | 'general'; // 인라인(특정 영역) vs 전반(전체)
  text: string;              // 코멘트 내용
  attachments: CommentAttachment[]; // 첨부파일 목록
  authorEno: string;         // 작성자 사번
  authorName: string;        // 작성자 이름
  authorTeam: ReviewerTeam;  // 작성자 팀
  createdAt: string;         // ISO 8601
  // 인라인 코멘트 전용 필드
  markId?: string;           // Tiptap Mark 식별자 (type='inline' 시 필수)
  quotedText?: string;       // 드래그한 원문 텍스트 스냅샷
  resolved: boolean;         // 해결 여부
}

/** 코멘트 첨부파일 */
interface CommentAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  // Phase 1에서는 File 객체 참조만 유지 (localStorage에는 메타만 저장)
  localRef?: File;
}

/** 사전협의 세션 전체 상태 */
interface ReviewSession {
  docMngNo: string;          // 문서 관리번호
  status: 'draft' | 'reviewing' | 'revised' | 'completed';
  currentVersion: string;    // 현재 버전
  versions: ReviewVersion[]; // 버전 이력
  reviewers: Reviewer[];     // 검토자 목록
  comments: ReviewComment[]; // 전체 코멘트
}
```

### 3.2 Entity Relationships

```
[ReviewSession] 1 ──── N [ReviewVersion]
       │
       ├── 1 ──── N [ReviewComment] 1 ──── N [CommentAttachment]
       │
       └── 1 ──── N [Reviewer]
```

### 3.3 localStorage Schema

```typescript
// 키 패턴: `review_session_{docMngNo}`
// 값: JSON.stringify(ReviewSession)

// 예시
localStorage.setItem('review_session_DOC001', JSON.stringify({
  docMngNo: 'DOC001',
  status: 'reviewing',
  currentVersion: '0.1',
  versions: [...],
  reviewers: [...],
  comments: [...]
}));
```

---

## 4. API Specification

> Phase 1에서는 백엔드 API 없이 localStorage로 동작합니다.
> 아래는 Phase 2 백엔드 연동 시 교체될 인터페이스입니다.

### 4.1 Composable API Interface (useReview)

| Method | Signature | Description |
|--------|-----------|-------------|
| loadSession | `(docMngNo: string) => void` | 세션 로드 (localStorage에서) |
| submitForReview | `() => void` | 검토요청 (버전 생성) |
| addComment | `(comment: Omit<ReviewComment, 'id' \| 'createdAt'>) => void` | 코멘트 추가 |
| resolveComment | `(commentId: string) => void` | 코멘트 해결 처리 |
| completeReview | `(reviewerEno: string) => void` | 검토완료 처리 |
| getVersion | `(version: string) => ReviewVersion \| undefined` | 특정 버전 조회 |
| updateContent | `(content: string) => void` | 본문 내용 업데이트 |

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ReviewToolbar                                                    │
│  ← 뒤로가기  │  문서 제목  │  v0.1 ▼  │  [검토요청]  [검토완료]  │
├──────────────────────────────────────┬───────────────────────────┤
│                                      │                           │
│  ReviewEditor (Tiptap)               │  ReviewMessenger          │
│  ┌────────────────────────────────┐  │  ┌───────────────────┐   │
│  │ ## 1. 현행 업무분석            │  │  │ 바로가기 목차       │   │
│  │    작성자가 입력한 내용...     │  │  │ [메신저] 탭         │   │
│  │    ████ 하이라이트 코멘트 ████ │  │  ├───────────────────┤   │
│  │ ### 1.1 업무 프로세스          │  │  │ 홍길동 (기획팀)     │   │
│  │    작성자가 입력한 내용...     │  │  │ "이 부분 수정 필요" │   │
│  │                                │  │  │ 10:30              │   │
│  │ ## 2. 요구사항 상세            │  │  │                     │   │
│  │    ...                         │  │  │ 김철수 (개발팀)     │   │
│  │                                │  │  │ "API 스펙 확인요"   │   │
│  │                                │  │  │ 10:45              │   │
│  │                                │  │  ├───────────────────┤   │
│  │                                │  │  │ [메시지 입력] [📎] │   │
│  └────────────────────────────────┘  │  └───────────────────┘   │
│                                      │                           │
│  (우클릭 시 PrimeVue ContextMenu)    │  ReviewVersionHistory     │
│  ┌──────────────────┐                │  (메신저 하단 또는 탭)     │
│  │ 💬 코멘트 달기    │                │                           │
│  │ 💬 전반 코멘트    │                │                           │
│  └──────────────────┘                │                           │
├──────────────────────────────────────┴───────────────────────────┤
│  검토 현황: 기획팀 ✅  개발/운영팀 ⏳  계약팀 ⏳  PMO팀 ⏳      │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 User Flow

```
[문서 상세] → [사전협의] 버튼 클릭
  → review.vue 진입 (문서 내용 로드)
  → 작성자: 내용 작성/수정 → [검토요청] → v0.1 생성
  → 검토자: 본문 읽기 → 드래그+우클릭 → 인라인 코멘트 등록
  → 검토자: 메신저에서 전반 코멘트 등록
  → 검토자: [검토완료] 클릭
  → 작성자: 코멘트 확인 → 내용 수정 → [검토요청] → v0.2 생성
  → (반복)
  → 전원 검토완료 시 상태 = 'completed'
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| review.vue | `pages/info/documents/[id]/review.vue` | 페이지 레이아웃, 컴포넌트 조합, 데이터 로드 |
| ReviewEditor | `components/review/ReviewEditor.vue` | Tiptap 에디터 초기화, 본문 렌더링, 우클릭 이벤트 처리, 코멘트 마크(하이라이트) 적용 |
| ReviewCommentPopover | `components/review/ReviewCommentPopover.vue` | 코멘트 입력 폼 (텍스트+첨부파일), 하이라이트 클릭 시 팝오버 표시 |
| ReviewMessenger | `components/review/ReviewMessenger.vue` | 우측 메신저 대화창, 코멘트 시간순 표시, 직접 입력, 코멘트↔본문 스크롤 연동 |
| ReviewToolbar | `components/review/ReviewToolbar.vue` | 상단 툴바 (뒤로가기, 버전 선택, 검토요청/검토완료 버튼, 검토 현황 배지) |
| ReviewVersionHistory | `components/review/ReviewVersionHistory.vue` | 버전 이력 목록, 이전 버전 조회 |

### 5.4 Page UI Checklist

#### review.vue (사전협의 페이지)

**Toolbar 영역:**
- [ ] Button: 뒤로가기 (`← 돌아가기`, `/info/documents/[id]`로 이동)
- [ ] Text: 문서 제목 표시
- [ ] Select: 버전 선택 드롭다운 (`v0.1`, `v0.2`, ...)
- [ ] Button: 검토요청 (`[검토요청]`, severity="info", 작성자만 표시)
- [ ] Button: 검토완료 (`[검토완료]`, severity="success", 검토자만 표시)
- [ ] Badge: 검토 현황 (팀별 pending/completed 상태 표시)

**Editor 영역:**
- [ ] Tiptap Editor: 문서 본문 렌더링 (HTML)
- [ ] H2/H3: 사전 정의 구조 텍스트 (삭제 불가, 배경색 구분)
- [ ] Mark: 인라인 코멘트 하이라이트 (노란색 배경, 클릭 가능)
- [ ] ContextMenu: 우클릭 메뉴 (텍스트 선택 시 "코멘트 달기", 미선택 시 "전반 코멘트")

**CommentPopover:**
- [ ] Textarea: 코멘트 내용 입력
- [ ] FileUpload: 첨부파일 추가 (드래그앤드롭 또는 버튼)
- [ ] Button: 등록 (`[등록]`)
- [ ] Button: 취소 (`[취소]`)
- [ ] Display: 기존 코멘트 내용 (하이라이트 클릭 시)

**Messenger 영역:**
- [ ] Tab: 바로가기 목차 / 메신저 탭 전환
- [ ] List: 코멘트 시간순 목록 (작성자명, 팀, 시각, 내용)
- [ ] Badge: 인라인 코멘트에는 "📍 인용문" 표시
- [ ] Highlight: 코멘트 클릭 시 본문 해당 위치 스크롤
- [ ] Textarea: 메시지 직접 입력
- [ ] Button: 첨부파일 추가 (`📎`)
- [ ] Button: 전송 (`[전송]`)

**하단 검토 현황:**
- [ ] Tag: 팀별 검토 상태 배지 (✅ completed / ⏳ pending)

---

## 6. Error Handling

| Scenario | Handling |
|----------|----------|
| localStorage 용량 초과 | Toast 경고 "저장 공간이 부족합니다", 세션 내 동작은 유지 |
| 코멘트 등록 실패 | Toast 오류, 입력 내용 유지 |
| 버전 로드 실패 | Toast 경고, 현재 버전 유지 |
| 첨부파일 크기 초과 (10MB) | 파일 선택 시 즉시 Toast 경고 |

---

## 7. Security Considerations

- [x] v-html 사용 시 DOMPurify 새니타이징 (CLAUDE.md §4.4 준수)
- [x] 코멘트 텍스트 XSS 방지 (Tiptap은 기본적으로 XSS-safe)
- [ ] 첨부파일 타입 검증 (허용: 이미지, PDF, HWP, XLSX, DOCX)
- [ ] Phase 2 백엔드 연동 시 인증/인가 처리

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| Unit | stores/review.ts, composables/useReview.ts | Vitest | Do |
| E2E | 사전협의 페이지 전체 시나리오 | Playwright | Do |

### 8.2 Unit Test Scenarios (Vitest)

| # | Target | Test Description | Expected |
|---|--------|-----------------|----------|
| 1 | store.addComment | 인라인 코멘트 추가 시 comments 배열 증가 | comments.length + 1 |
| 2 | store.submitForReview | 검토요청 시 새 버전 생성 | versions.length + 1, currentVersion 증가 |
| 3 | store.completeReview | 검토완료 시 검토자 상태 변경 | reviewer.status === 'completed' |
| 4 | store.completeReview | 전원 검토완료 시 세션 상태 변경 | session.status === 'completed' |
| 5 | store persistence | localStorage 저장/복원 | 새로고침 후 데이터 유지 |

### 8.3 E2E Test Scenarios (Playwright)

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-----------------|
| 1 | 검토요청 플로우 | 문서 진입 → 내용 확인 → [검토요청] 클릭 | v0.1 생성, 버전 드롭다운에 표시 |
| 2 | 인라인 코멘트 등록 | 본문 텍스트 드래그 → 우클릭 → 코멘트 입력 → 등록 | 하이라이트 표시, 메신저에 코멘트 표시 |
| 3 | 메신저 직접 입력 | 메신저 입력창에 코멘트 작성 → 전송 | 메신저 목록에 코멘트 추가 |
| 4 | 검토완료 플로우 | [검토완료] 클릭 | 팀 배지 상태 변경 (⏳→✅) |
| 5 | 버전 관리 | 수정 → [검토요청] → 버전 드롭다운에서 이전 버전 선택 | 이전 버전 내용 표시 |

---

## 9. Clean Architecture

### 9.1 Layer Structure (Nuxt 4 적용)

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | 페이지, 컴포넌트 | `app/pages/`, `app/components/review/` |
| **Application** | 비즈니스 로직, 상태 관리 | `app/composables/useReview.ts`, `app/stores/review.ts` |
| **Domain** | 타입 정의, 비즈니스 규칙 | `app/types/review.ts` |
| **Infrastructure** | 데이터 저장 | `localStorage` (Phase 2: API client) |

### 9.2 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| review.vue | Presentation | `app/pages/info/documents/[id]/review.vue` |
| ReviewEditor.vue | Presentation | `app/components/review/ReviewEditor.vue` |
| ReviewCommentPopover.vue | Presentation | `app/components/review/ReviewCommentPopover.vue` |
| ReviewMessenger.vue | Presentation | `app/components/review/ReviewMessenger.vue` |
| ReviewToolbar.vue | Presentation | `app/components/review/ReviewToolbar.vue` |
| ReviewVersionHistory.vue | Presentation | `app/components/review/ReviewVersionHistory.vue` |
| useReview.ts | Application | `app/composables/useReview.ts` |
| review.ts (store) | Application | `app/stores/review.ts` |
| review.ts (types) | Domain | `app/types/review.ts` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions (Nuxt 4 / Vue 프로젝트)

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `ReviewEditor`, `ReviewMessenger` |
| Composables | camelCase (use 접두사) | `useReview()` |
| Stores | camelCase (use 접두사) | `useReviewStore()` |
| Types/Interfaces | PascalCase | `ReviewComment`, `ReviewSession` |
| Files (component) | PascalCase.vue | `ReviewEditor.vue` |
| Files (composable) | camelCase.ts | `useReview.ts` |
| Files (store) | camelCase.ts | `review.ts` |
| Folders | kebab-case | `components/review/` |

### 10.2 Import Order (Nuxt 4)

```typescript
// 1. Vue / Nuxt 내장
import { ref, computed } from 'vue';

// 2. 외부 라이브러리
import { useEditor } from '@tiptap/vue-3';

// 3. 프로젝트 내부 (composables, stores, utils)
import { useReview } from '~/composables/useReview';

// 4. 타입
import type { ReviewComment } from '~/types/review';
```

### 10.3 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| Component naming | `Review` 접두사 통일 (ReviewEditor, ReviewMessenger 등) |
| File organization | `components/review/` 하위에 5개 컴포넌트 |
| State management | Pinia store (`useReviewStore`) + composable (`useReview`) 래핑 |
| 주석 | 한글 주석 필수 (CLAUDE.md §4.1) |

---

## 11. Implementation Guide

### 11.1 File Structure

```
app/
├── pages/info/documents/[id]/
│   └── review.vue                       ← 신규
├── components/review/
│   ├── ReviewEditor.vue                 ← 신규
│   ├── ReviewCommentPopover.vue         ← 신규
│   ├── ReviewMessenger.vue              ← 신규
│   ├── ReviewToolbar.vue                ← 신규
│   └── ReviewVersionHistory.vue         ← 신규
├── composables/
│   └── useReview.ts                     ← 신규
├── stores/
│   └── review.ts                        ← 신규
├── types/
│   └── review.ts                        ← 신규
└── pages/info/documents/[id].vue        ← 수정 (사전협의 버튼 추가)
```

### 11.2 Implementation Order

1. [ ] `types/review.ts` — 타입 정의
2. [ ] `stores/review.ts` — Pinia store (localStorage 영속화 포함)
3. [ ] `composables/useReview.ts` — 비즈니스 로직 composable
4. [ ] `components/review/ReviewEditor.vue` — Tiptap 에디터 + 코멘트 마크 Extension
5. [ ] `components/review/ReviewCommentPopover.vue` — 코멘트 입력 팝오버
6. [ ] `components/review/ReviewMessenger.vue` — 메신저 대화창
7. [ ] `components/review/ReviewToolbar.vue` — 툴바 (검토요청/검토완료)
8. [ ] `components/review/ReviewVersionHistory.vue` — 버전 이력
9. [ ] `pages/info/documents/[id]/review.vue` — 페이지 조합
10. [ ] `pages/info/documents/[id].vue` 수정 — 사전협의 버튼 추가
11. [ ] 테스트 작성

### 11.3 Session Guide

> Auto-generated from Design structure. Session split is recommended, not required.
> Use `/pdca do pre-consultation-review --scope module-N` to implement one module per session.

#### Module Map

| Module | Scope Key | Description | Files | Estimated Turns |
|--------|-----------|-------------|-------|:---------------:|
| Foundation | `module-1` | 타입 + Store + Composable | types/review.ts, stores/review.ts, composables/useReview.ts | 30-40 |
| Editor Core | `module-2` | Tiptap 에디터 + 코멘트 마크 + H2/H3 가드 + 우클릭 메뉴 | ReviewEditor.vue, ReviewCommentPopover.vue | 40-50 |
| Messenger & Tools | `module-3` | 메신저 대화창 + 툴바 + 버전 이력 + 페이지 조합 | ReviewMessenger.vue, ReviewToolbar.vue, ReviewVersionHistory.vue, review.vue | 40-50 |
| Integration | `module-4` | [id].vue 수정 + 테스트 작성 + 통합 검증 | [id].vue 수정, 테스트 | 20-30 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 (완료) | — |
| Session 2 | Do | `--scope module-1` | 30-40 |
| Session 3 | Do | `--scope module-2` | 40-50 |
| Session 4 | Do | `--scope module-3` | 40-50 |
| Session 5 | Do + Check | `--scope module-4` + analyze | 30-40 |

#### NPM 패키지 설치 (Session 2 시작 시)

```bash
cd it_frontend
npm install @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-highlight @tiptap/pm
```

---

## Tiptap Extension 설계

### 커스텀 Comment Mark

H2/H3 삭제 방지와 인라인 코멘트 하이라이트를 위한 Tiptap Extension 설계:

**1. CommentMark Extension** — 인라인 코멘트 하이라이트
```
Mark name: 'commentMark'
Attributes: { commentId: string, resolved: boolean }
렌더링: <span class="review-comment-highlight" data-comment-id="xxx">
스타일: 노란색 배경(미해결), 회색 배경(해결)
클릭 이벤트: commentId 기반으로 CommentPopover 표시
```

**2. HeadingGuard 로직** — H2/H3 삭제 방지
```
Tiptap의 transaction filter를 사용하여:
- H2/H3 노드의 삭제 트랜잭션 차단
- H2/H3 텍스트 내용 수정 차단
- H2/H3 뒤에 텍스트 추가는 허용 (새 paragraph 삽입)
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-06 | Initial draft | K140024 |
