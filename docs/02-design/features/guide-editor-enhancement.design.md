# guide-editor-enhancement Design — 사업 가이드 Editor 고도화 상세 설계

> Plan 참조: `docs/01-plan/features/guide-editor-enhancement.plan.md`
> 선택 아키텍처: **Option B — Clean Architecture** (TiptapToolbar 분리 + extensions 모듈화)

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 사업 가이드 에디터 버그 수정 + 고도화로 문서 작성 생산성 향상 |
| WHO | 가이드 문서 작성자 (관리자 역할 임직원) |
| RISK | Tiptap 3.x API 변경, mathlive SSR 비호환, 첨부파일 Suggestion 자동완성 충돌 |
| SUCCESS | 7개 PRD 항목 모두 구현, 저장-로드 왕복 테스트 통과 |
| SCOPE | TiptapEditor.vue 리팩토링 + TiptapToolbar.vue 신규 + extensions/ 신규 + NodeView 3개 신규 + guide/index.vue 수정 |

---

## 1. 아키텍처 개요

### 1.1 컴포넌트 분리 구조

현재 `TiptapEditor.vue` 단일 파일(~800줄+)을 다음과 같이 분리한다.

```
app/components/
├── TiptapEditor.vue                  # Core: editor 인스턴스, 상태, emit
├── TiptapToolbar.vue                 # NEW: 모든 툴바 UI + 다이얼로그
├── extensions/
│   └── tiptap-extensions.ts          # NEW: 모든 Tiptap 확장 등록 및 커스텀 정의
├── AttachmentNodeView.vue            # NEW: 첨부파일 인라인 노드 뷰
├── MathNodeView.vue                  # NEW: 인라인/블록 수식 노드 뷰
├── ExcalidrawNodeView.vue            # 기존 유지
└── ResizableImageNodeView.vue        # 기존 유지
```

### 1.2 데이터 흐름

```
guide/index.vue
  │  props: modelValue, imageUploadFn, fileUploadFn, attachmentList
  ▼
TiptapEditor.vue (핵심 상태 관리)
  │  editor instance (provide/prop)
  │  emit: update:modelValue, update:toc
  ├──▶ TiptapToolbar.vue
  │      props: editor
  │      다이얼로그: 링크, 이미지, 컬러피커, 파일 첨부, 수식
  └──▶ EditorContent (Tiptap 렌더링)
         ├── AttachmentNodeView.vue (첨부파일 노드)
         └── MathNodeView.vue (수식 노드)
```

---

## 2. 확장 설계 (`extensions/tiptap-extensions.ts`)

### 2.1 기존 확장 이전

현재 `TiptapEditor.vue` 내부에 정의된 모든 커스텀 확장을 `extensions/tiptap-extensions.ts`로 추출:

| 확장명 | 변경사항 |
|--------|---------|
| `ResizableImage` | 이전 (변경 없음) |
| `ExcalidrawExtension` | 이전 (변경 없음) |
| `CustomTable` | 이전 + `tableLayout` 속성 추가 |
| `CustomTableCell` | 이전 + `textAlign`, `borderStyle`, `minHeight` 속성 추가 |
| `CustomTableHeader` | 이전 + `textAlign` 속성 추가 |
| `CustomHeading` | 이전 (변경 없음) |

### 2.2 신규 확장

#### FontSizeExtension
```typescript
// TextStyle를 extend하여 fontSize 마크 추가
const FontSizeExtension = TextStyle.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            fontSize: {
                default: null,
                parseHTML: (element) => element.style.fontSize?.replace('px', '') || null,
                renderHTML: (attributes) => {
                    if (!attributes.fontSize) return {};
                    return { style: `font-size: ${attributes.fontSize}px` };
                }
            }
        };
    },
    addCommands() {
        return {
            setFontSize: (size: number) => ({ chain }) => {
                return chain().setMark('textStyle', { fontSize: size }).run();
            },
            unsetFontSize: () => ({ chain }) => {
                return chain().setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle().run();
            },
        };
    }
});
```

#### AttachmentExtension (첨부파일 노드)
```typescript
// 커스텀 인라인 노드: ![]() 문법으로 첨부파일 삽입
const AttachmentExtension = Node.create({
    name: 'attachment',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            fileId:   { default: null },  // 파일관리번호 (flMngNo)
            fileName: { default: '' },    // 파일명 표시용
            fileSize: { default: null },  // 파일 크기 (bytes)
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="attachment"]' }];
    },

    renderHTML({ node }) {
        return ['span', {
            'data-type': 'attachment',
            'data-file-id': node.attrs.fileId,
            'data-file-name': node.attrs.fileName,
        }];
    },

    addNodeView() {
        return VueNodeViewRenderer(AttachmentNodeView as any);
    }
});
```

#### AttachmentSuggestion (자동완성)
```typescript
// '![' 입력 시 파일 목록 Suggestion 팝업 트리거
// SuggestionOptions: char='![', command로 attachment 노드 삽입
```

#### InlineMathExtension / BlockMathExtension
```typescript
// 인라인 수식: $...$ 형태, inline: true
const InlineMathExtension = Node.create({
    name: 'inlineMath',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes() {
        return { latex: { default: '' } };
    },
    parseHTML() { return [{ tag: 'span[data-type="inline-math"]' }]; },
    renderHTML({ node }) {
        return ['span', { 'data-type': 'inline-math', 'data-latex': node.attrs.latex }];
    },
    addNodeView() { return VueNodeViewRenderer(MathNodeView as any); }
});

// 블록 수식: $$...$$ 형태, group: 'block'
const BlockMathExtension = Node.create({
    name: 'blockMath',
    group: 'block',
    atom: true,
    addAttributes() {
        return { latex: { default: '' } };
    },
    parseHTML() { return [{ tag: 'div[data-type="block-math"]' }]; },
    renderHTML({ node }) {
        return ['div', { 'data-type': 'block-math', 'data-latex': node.attrs.latex }];
    },
    addNodeView() { return VueNodeViewRenderer(MathNodeView as any); }
});
```

### 2.3 TextAlign 수정

```typescript
// 기존: types: ['heading', 'paragraph']
// 변경: TableCell, TableHeader 포함
TextAlign.configure({
    types: ['heading', 'paragraph', 'tableCell', 'tableHeader']
})
```

### 2.4 CustomTableCell 정렬 속성 추가

```typescript
// textAlign 속성 추가 (FR-01-2)
textAlign: {
    default: null,
    parseHTML: (element) => element.style.textAlign || null,
    renderHTML: (attributes) => {
        if (!attributes.textAlign) return {};
        return { style: `text-align: ${attributes.textAlign}` };
    }
},
// borderStyle 속성 추가 (FR-06-2)
borderStyle: {
    default: null,
    parseHTML: (element) => element.getAttribute('data-border-style') || null,
    renderHTML: (attributes) => {
        if (!attributes.borderStyle) return {};
        return { 'data-border-style': attributes.borderStyle };
    }
},
// minHeight 속성 추가 (FR-06-5)
minHeight: {
    default: null,
    parseHTML: (element) => element.style.minHeight || null,
    renderHTML: (attributes) => {
        if (!attributes.minHeight) return {};
        return { style: `min-height: ${attributes.minHeight}` };
    }
}
```

### 2.5 CodeBlockLowlight (FR-03)

```typescript
// StarterKit에서 codeBlock 비활성화 후 교체
StarterKit.configure({ codeBlock: false })

import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
const lowlight = createLowlight(common);

CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'plaintext',
    HTMLAttributes: { class: 'code-block' }
})
```

---

## 3. TiptapEditor.vue 리팩토링

### 3.1 리팩토링 후 구조

```typescript
// TiptapEditor.vue (리팩토링 후)
// - 확장 등록: extensions/tiptap-extensions.ts import
// - 툴바: <TiptapToolbar :editor="editor" ... />
// - 상태: isDragOver, editor, TOC 추출
// - 핵심 로직: useEditor 초기화, watch, emit

const props = defineProps<{
    modelValue: string;
    placeholder?: string;
    readonly?: boolean;
    imageUploadFn?: (file: File) => Promise<string>;
    // 신규
    fileUploadFn?: (file: File) => Promise<{ flMngNo: string; flNm: string; flSz: number }>;
    attachmentList?: Array<{ flMngNo: string; flNm: string; flSz: number }>;
}>();
```

### 3.2 TiptapEditor.vue 책임 범위

| 책임 | 위치 |
|------|------|
| editor 인스턴스 생성 및 관리 | TiptapEditor.vue |
| modelValue 동기화 (watch) | TiptapEditor.vue |
| TOC 추출 및 emit | TiptapEditor.vue |
| 드래그&드롭 이미지 | TiptapEditor.vue |
| 테이블 너비 정규화 | TiptapEditor.vue |
| 확장 정의 및 등록 | extensions/tiptap-extensions.ts |
| 툴바 UI (모든 버튼/다이얼로그) | TiptapToolbar.vue |

---

## 4. TiptapToolbar.vue 설계

### 4.1 Props 인터페이스

```typescript
// TiptapToolbar.vue
const props = defineProps<{
    editor: Editor | null;
    imageUploadFn?: (file: File) => Promise<string>;
    fileUploadFn?: (file: File) => Promise<{ flMngNo: string; flNm: string; flSz: number }>;
    attachmentList?: Array<{ flMngNo: string; flNm: string; flSz: number }>;
}>();
```

### 4.2 툴바 섹션 구성

```
[텍스트 서식]     Bold | Italic | Underline | Strike | Sub | Super
[폰트]            FontFamily | FontSize(Select: 10~24px) | Color | Highlight
[구조]            H1~H6 | BulletList | OrderedList | TaskList | Blockquote | CodeBlock
[정렬]            Left | Center | Right | Justify
[삽입]            Link | Image | Table | Diagram | Attachment(NEW) | Math(NEW)
[히스토리]         Undo | Redo
[테이블 툴바]      (테이블 선택 시 플로팅) 행/열 추가·삭제 | 병합 | 정렬 | 테두리 | 배경팔레트 | 반응형 | 높이
```

### 4.3 FontSize 셀렉터

```vue
<Select
    :model-value="currentFontSize"
    :options="FONT_SIZES"
    option-label="label"
    option-value="value"
    placeholder="크기"
    size="small"
    style="width: 80px"
    @change="(e) => editor?.chain().focus().setFontSize(e.value).run()"
/>

// FONT_SIZES: [10,12,14,16,18,20,22,24].map(px => ({ label: `${px}px`, value: px }))
```

### 4.4 셀 배경색 팔레트 (FR-06-3)

16색 팔레트로 교체:
```typescript
const TABLE_CELL_PALETTE = [
    '#ffffff', '#f1f5f9', '#e0e7ff', '#dbeafe', '#dcfce7',
    '#fef9c3', '#ffe4e6', '#f3e8ff', '#ffedd5', '#fce7f3',
    '#1e1b4b', '#1e3a5f', '#14532d', '#7c2d12', '#4a1d96',
    null // null = 배경 없음
];
```

### 4.5 코드 블록 언어 드롭다운

에디터 내 코드 블록 선택 시 툴바에 언어 드롭다운 표시:
```typescript
// 지원 언어 (lowlight common 기준)
const CODE_LANGUAGES = [
    { label: '일반 텍스트', value: 'plaintext' },
    { label: 'JavaScript', value: 'javascript' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
    { label: 'Java', value: 'java' },
    { label: 'SQL', value: 'sql' },
    { label: 'HTML', value: 'html' },
    { label: 'CSS', value: 'css' },
    { label: 'Bash', value: 'bash' },
    { label: 'JSON', value: 'json' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'YAML', value: 'yaml' },
];
```

---

## 5. AttachmentNodeView.vue 설계

### 5.1 UI 스펙

PRD 요구: "해당 라인 오른쪽 끝에 표시 (우측 상단 & 좌측 하단만 라운드, 진한 indigo색, 흰 글자 박스)"

```vue
<NodeViewWrapper as="span" class="attachment-node" contenteditable="false">
    <span
        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-white
               cursor-pointer select-none rounded-tr-md rounded-bl-md
               bg-indigo-700 hover:bg-indigo-800 transition-colors"
        @click="handleDownload"
    >
        <i class="pi pi-paperclip text-[10px]" />
        <span class="max-w-[120px] truncate">{{ node.attrs.fileName }}</span>
        <span v-if="node.attrs.fileSize" class="opacity-70">
            ({{ formatFileSize(node.attrs.fileSize) }})
        </span>
        <!-- 편집 모드에서만 삭제 버튼 표시 -->
        <button v-if="!readonly" @click.stop="deleteNode()" class="ml-1 opacity-60 hover:opacity-100">
            <i class="pi pi-times text-[9px]" />
        </button>
    </span>
</NodeViewWrapper>
```

### 5.2 다운로드 동작

```typescript
const handleDownload = () => {
    // /api/files/{flMngNo}/download 엔드포인트로 직접 이동
    window.open(`/api/files/${props.node.attrs.fileId}/download`, '_blank');
};
```

### 5.3 자동완성 (Suggestion) 동작

```
사용자 입력: "![" → Suggestion 활성화
→ attachmentList prop 기반 파일 목록 팝업 표시
→ 파일 선택 → editor.chain().insertContent({ type: 'attachment', attrs: { ... } }).run()
```

---

## 6. MathNodeView.vue 설계

### 6.1 mathlive 통합

```vue
<template>
    <NodeViewWrapper :as="isBlock ? 'div' : 'span'" class="math-node" contenteditable="false">
        <!-- 편집 모드: mathlive math-field -->
        <math-field
            v-if="editor?.isEditable"
            :value="node.attrs.latex"
            @input="(e) => updateAttributes({ latex: (e.target as any).value })"
            class="w-full border border-indigo-200 rounded p-1"
        />
        <!-- 조회 모드: mathlive static-math -->
        <math-field
            v-else
            read-only
            :value="node.attrs.latex"
        />
    </NodeViewWrapper>
</template>

<script setup lang="ts">
import { nodeViewProps } from '@tiptap/vue-3';
// mathlive는 Web Component → 클라이언트 사이드에서만 등록
if (process.client) {
    import('mathlive').then(() => {});
}
</script>
```

### 6.2 SSR 처리

`TiptapEditor.vue`는 이미 `<ClientOnly>` 내에서 사용되므로 MathNodeView도 자동으로 SSR 제외됨. 단, mathlive Custom Element 등록은 반드시 `process.client` 가드 필요.

---

## 7. FR-02 체크박스 버그 분석 및 수정

### 7.1 버그 원인

TaskItem은 저장 시 `<li data-type="taskItem" data-checked="false">` 형태로 직렬화됨.
로드 시 parseHTML이 `data-type="taskItem"` 어트리뷰트를 인식하지 못하면 일반 `<li>`로 처리.

**추가 원인**: `.guide-doc` CSS 범위에서 `ul li { list-style: ... }` 스타일이 TaskList에도 적용될 수 있음.

### 7.2 수정 방법

```typescript
// TaskItem 명시적 parseHTML 규칙 강화
TaskItem.configure({ nested: true }).extend({
    parseHTML() {
        return [
            { tag: 'li[data-type="taskItem"]' },
            // 레거시 호환
            { tag: 'li.task-item' }
        ];
    }
})
```

```css
/* assets/css/guide-doc.css 또는 TiptapEditor 내 <style> */
/* TaskList 전용 스타일 (목록 기호 제거) */
ul[data-type="taskList"] > li {
    list-style: none !important;
    padding-left: 0;
}
ul[data-type="taskList"] > li::before {
    content: none !important;
}
```

---

## 8. guide/index.vue 변경사항

### 8.1 신규 Props 전달

```typescript
// 첨부파일 업로드 핸들러
const handleEditorFileUpload = async (file: File) => {
    const orcPkVl = currentGuide.value?.docMngNo ?? '';
    const result = await uploadFile(file, '첨부파일', orcPkVl, '가이드문서');
    // 신규 문서인 경우 pendingFileIds에 추적
    if (!currentGuide.value) {
        pendingFileIds.value.push(result.flMngNo);
    }
    return result; // { flMngNo, flNm, flSz }
};

// 첨부파일 목록 (현재 문서의 파일 목록 → Suggestion에서 활용)
const { data: attachmentList, refresh: refreshAttachments } = await fetchFiles({
    orcDtt: '가이드문서',
    orcPkVl: computed(() => currentGuide.value?.docMngNo)
});
```

```vue
<TiptapEditor
    v-if="isEditing"
    v-model="editContent"
    :imageUploadFn="handleEditorImageUpload"
    :fileUploadFn="handleEditorFileUpload"   <!-- 신규 -->
    :attachmentList="attachmentList ?? []"   <!-- 신규 -->
    @update:toc="handleUpdateToc"
/>
```

---

## 9. 패키지 설치

```bash
npm install @tiptap/extension-code-block-lowlight lowlight highlight.js mathlive
```

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@tiptap/extension-code-block-lowlight` | ^3.x | 코드 블록 언어 하이라이팅 |
| `lowlight` | ^3.x | 코드 하이라이팅 엔진 |
| `highlight.js` | (lowlight peer) | 언어 정의 |
| `mathlive` | ^0.100.x | LaTeX 수식 Web Component |

---

## 10. 기존 HTML 호환성 처리

| 항목 | 호환 방법 |
|------|---------|
| 기존 `<pre><code>` 코드 블록 | CodeBlockLowlight 기본 parseHTML이 처리 (언어 없음 → plaintext) |
| 기존 체크박스 HTML | parseHTML 규칙 강화로 처리 |
| 기존 TextAlign HTML | style 속성 parseHTML 기존과 동일 |
| 기존 테이블 배경색 | CustomTableCell 속성 추가 시 기존 `background-color` 스타일 유지 |

---

## 11. Implementation Guide

### 11.1 구현 순서

| 순서 | 모듈 | 파일 | 예상 난이도 |
|------|------|------|-----------|
| 1 | 버그 수정 | TiptapEditor.vue | 낮음 |
| 2 | 리팩토링 | TiptapEditor.vue → TiptapToolbar.vue 분리 | 중간 |
| 3 | extensions 추출 | extensions/tiptap-extensions.ts 신규 | 낮음 |
| 4 | FontSize | extensions + TiptapToolbar.vue | 낮음 |
| 5 | CodeBlockLowlight | extensions + TiptapToolbar.vue | 중간 |
| 6 | 테이블 고도화 | extensions + TiptapToolbar.vue | 중간 |
| 7 | 첨부파일 | AttachmentNodeView.vue + extensions + TiptapToolbar.vue + guide/index.vue | 높음 |
| 8 | LaTeX | MathNodeView.vue + extensions + TiptapToolbar.vue | 높음 |

### 11.2 구현 주의사항

1. **TiptapToolbar 분리 시**: `editor.value` watch와 `isActive()` 반응성 확인 (editor가 null인 시점 처리)
2. **extensions 추출 시**: `VueNodeViewRenderer`의 import는 각 NodeView 컴포넌트가 있는 파일 기준으로 처리
3. **mathlive**: `customElements.define` 중복 등록 방지 → `customElements.get('math-field')` 체크 후 등록
4. **Suggestion**: Tiptap `@tiptap/suggestion` 패키지 별도 설치 필요 확인 (starter-kit에 포함 여부)
5. **테이블 CSS**: `borderStyle` 속성은 `data-border-style` attribute로 저장 후 CSS selector로 스타일 적용 (`[data-border-style="dashed"] td { border-style: dashed }`)

### 11.3 Session Guide

#### Module Map

| 모듈 | 설명 | 관련 FR |
|------|------|---------|
| module-1 | 버그 수정 (정렬·체크박스) | FR-01, FR-02 |
| module-2 | 리팩토링 (TiptapToolbar 분리, extensions 추출) | - |
| module-3 | FontSize + CodeBlockLowlight | FR-03, FR-04 |
| module-4 | 테이블 고도화 | FR-06 |
| module-5 | 첨부파일 기능 | FR-05 |
| module-6 | LaTeX 수식 (mathlive) | FR-07 |

#### Recommended Session Plan

| 세션 | 모듈 | 예상 작업량 |
|------|------|-----------|
| Session 1 | module-1 + module-2 | 버그 수정 + 리팩토링 (기반 작업) |
| Session 2 | module-3 | 패키지 추가 + 코드/폰트 기능 |
| Session 3 | module-4 | 테이블 고도화 |
| Session 4 | module-5 | 첨부파일 (가장 복잡) |
| Session 5 | module-6 | LaTeX 수식 |

```bash
# 세션별 실행 예시
/pdca do guide-editor-enhancement --scope module-1,module-2
/pdca do guide-editor-enhancement --scope module-3
/pdca do guide-editor-enhancement --scope module-4
/pdca do guide-editor-enhancement --scope module-5
/pdca do guide-editor-enhancement --scope module-6
```
