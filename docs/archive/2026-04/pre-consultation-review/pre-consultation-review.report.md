# 사전협의 고도화 — PDCA Completion Report

> **Feature**: pre-consultation-review (사전협의 고도화)
> **Date**: 2026-04-06
> **Author**: K140024
> **Match Rate**: 100%
> **Iterations**: 0 (Check phase에서 즉시 통과)

---

## Executive Summary

| Perspective | Planned | Delivered |
|-------------|---------|-----------|
| **Problem** | 요구사항 정의서 검토가 오프라인/메일로 비효율적, 이력 추적 불가 | 온라인 협업 검토 시스템 구현 완료 (프론트엔드 Phase 1) |
| **Solution** | 인라인 코멘트 + 메신저형 대화창 + 버전 관리 | Tiptap 에디터 기반 CommentMark + ReviewMessenger + 버전 관리 구현 |
| **Function/UX** | 드래그→우클릭 코멘트, 하이라이트+메모, 실시간 대화 | 모든 UX 플로우 구현 완료, 4개 팀 검토 워크플로우 동작 |
| **Core Value** | 검토 의견 투명한 이력 관리, 검토 사이클 단축 | localStorage 기반 세션 영속화로 새로고침 후에도 데이터 유지 |

### Value Delivered

- 신규 9개 파일 + 1개 파일 수정으로 완전한 사전협의 기능 구현
- Tiptap 에디터 신규 도입 (4개 패키지)으로 리치 텍스트 편집 + 커스텀 Extension 지원
- 백엔드 없이 localStorage로 동작하되, Phase 2에서 composable 내부만 교체하면 API 연동 가능한 구조

---

## 1. PDCA Phase Summary

| Phase | Duration | Output |
|-------|----------|--------|
| Plan | 1 session | `docs/01-plan/features/pre-consultation-review.plan.md` |
| Design | 1 session | `docs/02-design/features/pre-consultation-review.design.md` |
| Do | 1 session | 9 files created, 1 file modified |
| Check | 1 session | Match Rate 100%, 1 Critical issue fixed (routing) |

---

## 2. Success Criteria Final Status

| # | Criteria | Status | Evidence |
|---|----------|:------:|----------|
| SC-1 | 사전협의 전용 페이지에서 문서 조회 및 편집 가능 | ✅ Met | `pages/info/documents/[id]/review.vue` — fetchDocument + Tiptap Editor |
| SC-2 | H2/H3 고정 구조가 삭제 불가하게 동작 | ✅ Met | `ReviewEditor.vue` — headingGuardPlugin (filterTransaction) |
| SC-3 | 검토요청 시 버전이 증가하며 이전 버전 열람 가능 | ✅ Met | `stores/review.ts` — submitForReview(), ReviewVersionHistory.vue |
| SC-4 | 본문 드래그→우클릭으로 인라인 코멘트 등록 및 하이라이트 표시 | ✅ Met | `ReviewEditor.vue` — CommentMark Extension + ReviewCommentPopover |
| SC-5 | 우측 메신저 대화창에 코멘트 연동 및 직접 입력 동작 | ✅ Met | `ReviewMessenger.vue` — store.sortedComments + direct input |
| SC-6 | 검토자별 검토완료 처리 가능 | ✅ Met | `ReviewToolbar.vue` — reviewer selection Dialog + completeReview |
| SC-7 | localStorage/Pinia에 데이터 저장/복원 정상 동작 | ✅ Met | `stores/review.ts` — _persist() + loadSession() |

**Overall Success Rate: 7/7 (100%)**

---

## 3. Key Decisions & Outcomes

| Decision | Source | Followed | Outcome |
|----------|--------|:--------:|---------|
| Tiptap 에디터 사용 | Plan §7.2 | ✅ | CommentMark, HeadingGuard 커스텀 Extension 성공적 구현 |
| 별도 페이지 `/info/documents/[id]/review` | Plan §7.2 | ✅ | 기존 상세 페이지 영향 없음. 단, 라우팅 충돌 이슈 발견→수정 |
| localStorage + Pinia | Plan §7.2 | ✅ | 백엔드 없이 완전한 UX 동작, Phase 2 교체 용이 |
| Option C Pragmatic (5 컴포넌트 분리) | Design §2.0 | ✅ | 컴포넌트별 150줄 이하, 유지보수성 확보 |
| PrimeVue ContextMenu 사용 | Plan §7.2 | ✅ (변형) | 커스텀 구현으로 대체 — Tiptap handleDOMEvents와 통합이 더 자연스러움 |

---

## 4. Issues & Resolutions

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | Critical | `[id].vue`와 `[id]/` 디렉토리 동시 존재로 Nuxt 중첩 라우트 충돌 — 사전협의 버튼 반응 없음 | `[id].vue` → `[id]/index.vue`로 이동하여 형제 라우트로 변경 |

---

## 5. Deliverables

### 신규 파일 (9개)

| File | Lines | Role |
|------|:-----:|------|
| `app/types/review.ts` | ~80 | 도메인 타입 (ReviewSession, ReviewComment 등) |
| `app/stores/review.ts` | ~190 | Pinia store + localStorage 영속화 |
| `app/composables/useReview.ts` | ~100 | 비즈니스 로직 composable |
| `app/components/review/ReviewEditor.vue` | ~200 | Tiptap + CommentMark + HeadingGuard |
| `app/components/review/ReviewCommentPopover.vue` | ~200 | 코멘트 입력/표시 팝오버 |
| `app/components/review/ReviewMessenger.vue` | ~260 | 메신저 대화창 |
| `app/components/review/ReviewToolbar.vue` | ~150 | 상단 툴바 + 검토자 선택 Dialog |
| `app/components/review/ReviewVersionHistory.vue` | ~80 | 버전 이력 타임라인 |
| `app/pages/info/documents/[id]/review.vue` | ~200 | 페이지 레이아웃 조합 |

### 수정 파일 (1개)

| File | Change |
|------|--------|
| `app/pages/info/documents/[id]/index.vue` | 「사전협의」 버튼 추가 (기존 `[id].vue`에서 이동) |

### 설치 패키지 (4개)

| Package | Purpose |
|---------|---------|
| `@tiptap/vue-3` | Tiptap Vue 3 바인딩 |
| `@tiptap/starter-kit` | 기본 Extension 번들 |
| `@tiptap/extension-highlight` | 텍스트 하이라이트 |
| `@tiptap/pm` | ProseMirror 코어 (Plugin, PluginKey) |

### PDCA 문서

| Document | Path |
|----------|------|
| Plan | `docs/01-plan/features/pre-consultation-review.plan.md` |
| Design | `docs/02-design/features/pre-consultation-review.design.md` |
| Report | `docs/04-report/features/pre-consultation-review.report.md` |

---

## 6. Lessons Learned

1. **Nuxt 라우팅 주의**: 동일 이름의 `.vue` 파일과 `/` 디렉토리가 공존하면 중첩 라우트로 처리됨. 형제 라우트가 필요하면 반드시 `index.vue`로 변환 필요.
2. **Tiptap Extension 확장성**: Mark 기반 커스텀 Extension으로 인라인 코멘트 구현이 예상보다 자연스러웠음. `@tiptap/extension-collaboration` 없이도 충분.
3. **Phase 1 (프론트 only) 전략 유효**: localStorage + Pinia로 백엔드 없이 완전한 UX를 구현하되, composable 인터페이스를 통해 Phase 2 API 교체가 용이한 구조 확보.

---

## 7. Next Steps (Phase 2)

- [ ] 백엔드 API 개발 (사전협의 CRUD + 코멘트 API)
- [ ] `useReview.ts` composable 내부를 API 호출로 교체
- [ ] 첨부파일 서버 업로드 연동
- [ ] 실시간 알림 (WebSocket 또는 SSE)
- [ ] 권한 관리 (작성자/검토자 역할 분리)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-04-06 | PDCA 완료 리포트 | K140024 |
