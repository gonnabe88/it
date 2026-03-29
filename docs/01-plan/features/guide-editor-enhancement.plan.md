## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | guide-editor-enhancement (사업 가이드 Editor 고도화) |
| 작성일 | 2026-03-29 |
| 단계 | Plan |

### Value Delivered

| 관점 | 내용 |
|------|------|
| Problem | 사업 가이드 에디터의 정렬 저장 버그·체크박스 렌더링 오류 등 UX 장애와 코드 하이라이팅·폰트 크기·첨부파일·LaTeX 수식 등 문서 작성에 필요한 기능 부재 |
| Solution | Tiptap 확장 버그 수정(정렬·체크박스) 및 신규 확장(CodeBlockLowlight·FontSize·첨부파일·테이블 고도화·MathLive LaTeX) 추가 |
| Function UX Effect | 저장 후 정렬·체크박스가 정확히 복원되고, 코드 하이라이팅·폰트 크기 조절·첨부파일 인라인 삽입·수식 입력을 에디터 안에서 완결 |
| Core Value | 3,000명 임직원이 IT 정보화사업 가이드 문서를 전문 편집기 수준으로 작성·관리할 수 있어 문서 품질과 생산성 향상 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 사업 가이드 에디터 버그 수정 + 고도화로 문서 작성 생산성 향상 |
| WHO | 가이드 문서 작성자 (관리자 역할 임직원) |
| RISK | Tiptap 3.x API 변경, mathlive SSR 비호환, 첨부파일 Suggestion 자동완성 충돌 |
| SUCCESS | 7개 PRD 항목 모두 구현, 저장-로드 왕복 테스트 통과 |
| SCOPE | TiptapEditor.vue + 관련 NodeView 컴포넌트 + guide/index.vue 첨부파일 핸들러 |

---

# guide-editor-enhancement Plan — 사업 가이드 Editor 고도화

## 1. 개요

### 1.1 배경 및 목적

IT Portal의 사업 가이드(`/guide`) 화면은 Tiptap 기반 리치 에디터(`TiptapEditor.vue`)를 사용한다.
현재 다음 문제가 존재하며 추가 기능 요구도 접수되었다.

| 구분 | 내용 |
|------|------|
| 버그 | 정렬 저장 후 소실, 체크박스 → 불릿 변환 |
| 기능 부재 | 코드 블록 언어 하이라이팅, 폰트 크기 조절, 첨부파일 삽입, 테이블 고도화, LaTeX 수식 |

### 1.2 현황 분석

**현재 적용된 Tiptap 확장 (관련 항목)**

| 확장 | 현황 | 문제 |
|------|------|------|
| TextAlign | heading/paragraph에만 적용 | TableCell 정렬 저장 불가 |
| TaskList/TaskItem | 설치됨 | 저장 시 불릿으로 렌더링 |
| CodeBlock (StarterKit 내) | 기본 코드 블록 | 언어 설정·하이라이팅 없음 |
| TextStyle | 설치됨 | FontSize 속성 미구현 |
| CustomTable/CustomTableCell | 배경색 지원 | 정렬·테두리·반응형·높이 미구현 |

---

## 2. 요구사항

### 2.1 기능 요구사항

#### FR-01 정렬 기능 정상화

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01-1 | 텍스트(heading/paragraph) 정렬 저장-복원 버그 수정 | P1 |
| FR-01-2 | TableCell 내 텍스트 정렬 저장-복원 지원 | P1 |

**기술 분석**: `TextAlign`을 `['heading', 'paragraph', 'tableCell', 'tableHeader']`로 확장하고, `CustomTableCell`에 `textAlign` 속성 추가.

#### FR-02 체크박스 표기 오류 개선

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-02-1 | 저장 후 불러올 때 TaskItem이 체크박스로 정상 복원 | P1 |

**기술 분석**: TaskItem의 `parseHTML` 규칙에서 `data-type="taskItem"` 어트리뷰트 인식 확인 및 CSS `.guide-doc` 범위 내 `ul[data-type="taskList"]` 스타일 보완.

#### FR-03 코드 블록 언어 하이라이팅

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-03-1 | 코드 블록에 언어 설정 드롭다운 UI 추가 | P2 |
| FR-03-2 | 선택한 언어에 맞는 Syntax Highlighting 적용 | P2 |
| FR-03-3 | 저장 후 언어 설정 복원 | P2 |

**기술 분석**: StarterKit의 `codeBlock: false` → `@tiptap/extension-code-block-lowlight` + `lowlight` + `highlight.js` 설치 및 교체.

#### FR-04 폰트 크기 조절

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-04-1 | 툴바에 폰트 크기 셀렉터 추가 (10px ~ 24px, 2px 단위) | P2 |
| FR-04-2 | 선택 영역에 폰트 크기 적용 및 저장 복원 | P2 |

**기술 분석**: `TextStyle`을 extend하여 `fontSize` 속성(`font-size` CSS) 추가. 툴바에 `<Select>` PrimeVue 컴포넌트로 8단계(10, 12, 14, 16, 18, 20, 22, 24px) 제공.

#### FR-05 첨부파일 기능

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-05-1 | `/api/files/` API 활용 첨부파일 업로드 | P2 |
| FR-05-2 | 기존 이미지 업로드와 독립적인 파일 첨부 버튼 툴바 추가 | P2 |
| FR-05-3 | `![` 입력 시 현재 문서의 첨부파일 목록 자동완성 팝업 표시 | P2 |
| FR-05-4 | 팝업 선택 시 `![파일명](파일ID)` 형태 커스텀 노드 삽입 | P2 |
| FR-05-5 | 첨부파일 노드는 라인 우측 끝에 박스(우측 상단·좌측 하단 라운드, indigo 배경, 흰 글자) 표시 | P2 |
| FR-05-6 | 첨부파일 박스 클릭 시 다운로드, 삭제 기능 포함 | P2 |

**기술 분석**:
- Tiptap `Suggestion` extension으로 `![` 트리거 자동완성 구현
- 커스텀 `AttachmentNode` TiptapNode (block/inline) + `AttachmentNodeView.vue` 컴포넌트
- `guide/index.vue`에 `handleEditorFileUpload` 핸들러 추가
- 첨부파일 목록 조회: `useFiles` composable의 getFileList 또는 `/api/files?orcPkVl={docMngNo}` 활용

#### FR-06 테이블 기능 고도화

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-06-1 | 테이블 셀 텍스트 정렬 (FR-01-2와 동일 구현) | P1 |
| FR-06-2 | 테이블 테두리 Style 설정 (없음/실선/점선/이중선) | P3 |
| FR-06-3 | 셀 배경색 팔레트 방식으로 변경 (기존 RGB → 16색 팔레트) | P2 |
| FR-06-4 | 테이블 반응형(table-layout: auto) / 고정형(fixed) 전환 | P3 |
| FR-06-5 | 테이블 셀 높이 조절 (min-height 속성 저장) | P3 |

**기술 분석**:
- `CustomTable`에 `tableLayout` 속성 추가 (`fixed` / `auto`)
- `CustomTableCell`에 `borderStyle`, `minHeight` 속성 추가
- 테이블 플로팅 툴바에 팔레트 색상 선택기 교체

#### FR-07 LaTeX 수식 (mathlive)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-07-1 | mathlive 라이브러리 설치 (`mathlive`) | P3 |
| FR-07-2 | 인라인 수식 (`$...$`) 커스텀 Tiptap 노드 + NodeView | P3 |
| FR-07-3 | 블록 수식 (`$$...$$`) 커스텀 Tiptap 노드 + NodeView | P3 |
| FR-07-4 | 툴바 "수식" 버튼 → 빈 수식 노드 삽입 후 mathlive 편집 활성화 | P3 |
| FR-07-5 | 저장 후 LaTeX 문자열 복원 및 렌더링 | P3 |

**기술 분석**: mathlive는 Web Component(`<math-field>`) 기반. Nuxt 4 SSR 환경에서 `ClientOnly` 처리 필요 (기존 TiptapEditor가 이미 `ClientOnly` 내에서 사용됨). `InlineMathNode`, `BlockMathNode` 커스텀 확장으로 LaTeX 문자열을 `data-latex` 속성에 저장.

### 2.2 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-01 | 저장-로드 왕복 테스트: 모든 신규 기능 적용 후 HTML 직렬화/파싱 왕복 시 데이터 손실 없음 |
| NFR-02 | SSR 호환: TiptapEditor.vue는 `client:only` 환경에서만 실행. mathlive SSR 오류 방지 |
| NFR-03 | 기존 저장 데이터 호환: 신규 확장 추가 후 기존 HTML이 정상 표시되어야 함 |
| NFR-04 | 번들 사이즈 고려: highlight.js는 필요 언어만 등록 (common 언어셋 사용) |

---

## 3. 범위 (Scope)

### 3.1 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `app/components/TiptapEditor.vue` | 수정 | 확장 추가/교체, 툴바 UI 추가 |
| `app/components/AttachmentNodeView.vue` | 신규 | 첨부파일 NodeView 컴포넌트 |
| `app/components/InlineMathNodeView.vue` | 신규 | 인라인 LaTeX NodeView |
| `app/components/BlockMathNodeView.vue` | 신규 | 블록 LaTeX NodeView |
| `app/pages/guide/index.vue` | 수정 | 첨부파일 업로드 핸들러, 파일 목록 전달 |
| `app/composables/useFiles.ts` | 수정 (필요시) | 파일 목록 조회 함수 추가 |
| `it_frontend/package.json` | 수정 | 신규 패키지 추가 |

### 3.2 신규 패키지

| 패키지 | 용도 |
|--------|------|
| `@tiptap/extension-code-block-lowlight` | 코드 블록 언어 하이라이팅 |
| `lowlight` | 코드 하이라이팅 엔진 |
| `highlight.js` | 언어 정의 (common 언어셋) |
| `mathlive` | LaTeX 수식 입력 Web Component |

### 3.3 범위 외 (Out of Scope)

- 백엔드 API 변경 없음 (기존 `/api/files/`, `/api/guide-documents/` 그대로 사용)
- 다른 에디터 사용처 변경 없음 (`RichEditor.client.vue` 등)

---

## 4. 구현 순서 (우선순위 기반)

| 순서 | 항목 | 이유 |
|------|------|------|
| 1 | FR-01 정렬 버그 수정 | P1 버그, 구현 범위 작음 |
| 2 | FR-02 체크박스 버그 수정 | P1 버그, 구현 범위 작음 |
| 3 | FR-06-3 테이블 셀배경 팔레트 | P2, 기존 속성 재활용 |
| 4 | FR-04 폰트 크기 조절 | P2, TextStyle 확장 |
| 5 | FR-03 코드 블록 하이라이팅 | P2, 패키지 추가 필요 |
| 6 | FR-05 첨부파일 기능 | P2, 구현 복잡도 높음 |
| 7 | FR-06-2,4,5 테이블 고도화 (테두리/반응형/높이) | P3 |
| 8 | FR-07 LaTeX 수식 | P3, 패키지 추가 필요 |

---

## 5. 리스크

| 리스크 | 가능성 | 영향 | 대응책 |
|--------|--------|------|--------|
| mathlive Web Component SSR 오류 | 중 | 중 | NodeView를 `<client-only>` 래핑 또는 `process.client` 가드 |
| Tiptap 3.x CodeBlockLowlight API 변경 | 중 | 중 | 공식 문서 v3 기준 구현, 기존 StarterKit codeBlock 비활성화 |
| 첨부파일 Suggestion 자동완성이 마크다운 Link 확장과 충돌 | 낮 | 중 | Suggestion의 char를 `![`로 한정, Link autolink 비충돌 확인 |
| 기존 저장 HTML의 CodeBlock 파싱 호환 | 중 | 중 | CodeBlockLowlight가 기본 `<pre><code>` 파싱 지원 확인 |

---

## 6. 성공 기준

| 기준 | 검증 방법 |
|------|---------|
| 텍스트 정렬 저장-복원 | 정렬 적용 → 저장 → 페이지 리로드 → 정렬 유지 확인 |
| 테이블 셀 정렬 저장-복원 | 테이블 셀 정렬 → 저장 → 리로드 → 정렬 유지 확인 |
| 체크박스 정상 표시 | 체크박스 추가 → 저장 → 리로드 → 체크박스로 표시 |
| 코드 블록 하이라이팅 | 언어 선택 → 저장 → 리로드 → 언어·색상 유지 |
| 폰트 크기 조절 | 10~24px 선택 → 저장 → 리로드 → 크기 유지 |
| 첨부파일 삽입 | `![` 입력 → 목록 표시 → 선택 → 박스 노드 삽입 → 클릭 시 다운로드 |
| 테이블 고도화 | 각 설정(테두리/팔레트/반응형/높이) → 저장 → 리로드 → 설정 유지 |
| LaTeX 수식 | 수식 입력 → 저장 → 리로드 → 수식 정상 렌더링 |
