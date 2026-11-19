# Editor UX Plan

이 문서는 Pediary 문서 편집기/보기 렌더링 개선 전에 현재 구조와 안전한 구현 방향을 정리한 작업 기준서다.

절대 누락되면 안 되는 핵심 기능:

- Heading 기반 섹션 번호: 보기 모드에서 `1.`, `1.1.`처럼 자동 번호가 붙어야 한다.
- 내부 링크: `[[...]]` 문법으로 다른 문서 또는 특정 섹션으로 이동할 수 있어야 한다.
- 저장된 문서의 기존 `content_markdown` 포맷은 깨지면 안 된다.

## 1. 내부 링크 UX 개선

### 현재 상태

업무 레벨:

- 사용자는 편집 중 `[[`를 입력하면 문서/섹션 후보를 선택할 수 있다.
- 선택된 링크는 보기 모드에서 일반 링크처럼 보이고, 클릭하면 해당 문서 또는 섹션으로 이동한다.
- 기능은 강력하지만 `[[` 입력, 후보 표시, 저장되는 `doc:123#1.1|라벨` 포맷이 사용자에게 직관적이지 않다.

소스 레벨:

- 편집 UI: `src/features/wiki/MarkdownEditor.jsx`
- 후보 생성:
  - `allDocs` 전체를 돌면서 문서 후보와 섹션 후보를 만든다.
  - 섹션 후보는 `extractSectionsFromMarkdown()`으로 각 문서의 heading을 파싱해서 만든다.
- 링크 삽입:
  - `applyInternalLink()`가 선택 후보를 `buildInternalLink()`로 변환한다.
  - 저장 포맷은 `[[doc:123|문서명]]`, `[[doc:123#1.1|섹션명]]`이다.
- 보기 렌더링:
  - `src/lib/internalLinkParser.js`의 `parseInternalLinks()`가 `[[...]]`를 Markdown 링크 `[라벨](/wiki/slug#sec-1-1)`로 변환한다.
- 링크 포맷:
  - `src/lib/internalLinkFormat.js`
  - `parseInternalLinkInner()`
  - `buildInternalLink()`

### 안전한 구현 방향

- 저장 포맷은 유지한다: `[[doc:id#section|label]]`
- 편집 UI만 개선한다.
- `[[` 자동완성은 유지한다.
- 추가로 툴바 또는 에디터 하단에 "내부 링크" 버튼을 제공한다.
- 링크 검색 팝업은 문서 후보와 섹션 후보를 시각적으로 분리한다.
  - 문서: `문서명`
  - 섹션: `문서명 > 1.2 섹션명`
- 선택 후 삽입되는 실제 markdown은 기존 `buildInternalLink()`만 사용한다.
- `parseInternalLinks()`는 변경하지 않는 것을 우선한다.

### UX 개선 효과

- 사용자는 `[[` 문법을 몰라도 버튼으로 내부 링크를 만들 수 있다.
- 후보 목록에서 문서와 섹션을 구분할 수 있어 선택 실수가 줄어든다.
- 저장 포맷을 유지하므로 기존 문서와 역링크 로직이 깨질 가능성이 낮다.

### 주의점

- `buildInternalLink()`를 우회해서 문자열을 직접 조립하지 않는다.
- 섹션 번호는 문서 내용이 바뀌면 바뀔 수 있다. 현재 `updateSectionLinksForDocument()`가 섹션 번호 변경 시 링크를 보정하므로 기존 포맷을 유지해야 한다.
- `parseInternalLinks()`가 문서 권한/존재 여부에 따라 표시 텍스트만 남기는 동작을 한다. 이 fallback을 깨면 안 된다.
- `[[` 자동완성 팝업과 새 링크 삽입 팝업이 동시에 열리지 않도록 상태를 분리하거나 재사용해야 한다.

## 2. 편집 모드 Heading 섹션 번호 표시

### 현재 상태

업무 레벨:

- 보기 모드에서는 heading 앞에 `1.`, `1.1.` 같은 섹션 번호가 자동으로 보인다.
- 편집 모드에서는 본문 heading 앞에는 번호가 보이지 않고, 좌측 섹션 목록에만 번호가 보인다.
- 사용자는 편집 중 현재 heading이 보기 모드에서 몇 번 섹션이 될지 즉시 알기 어렵다.

소스 레벨:

- 보기 모드 섹션 번호 생성: `src/features/wiki/DocumentPage.jsx`의 `buildSectionTree()`
- `buildSectionTree()`는 markdown heading을 찾아:
  - heading 번호를 계산한다.
  - anchor id를 만든다. 예: `sec-1-1`
  - 보기용 markdown에 `<span class="wiki-heading-number">1.1.</span>`를 삽입한다.
- 편집 모드:
  - `MarkdownEditor.jsx`가 Toast UI Editor를 렌더링한다.
  - 저장 markdown 자체에는 번호가 들어가지 않는다.

### 안전한 구현 방향

- 저장 markdown에 번호를 넣으면 안 된다.
- 편집 화면에만 DOM 장식으로 번호를 보여준다.
- 구현 방식:
  1. 편집 모드에서 현재 markdown 기준 heading 번호를 계산한다.
  2. Toast UI Editor 내부 `.toastui-editor-contents h1,h2,h3,h4,h5,h6` 또는 `.ProseMirror h1...`를 찾는다.
  3. 각 heading에 `data-section-number="1.2"` 같은 속성을 붙인다.
  4. CSS `::before`로 번호를 표시한다.
  5. 사용자가 번호 텍스트를 직접 수정할 수 없게 한다.
- 번호 계산 로직은 가능하면 `buildSectionTree()`와 동일한 규칙을 공유하거나, 별도 유틸로 추출해서 중복을 줄인다.

### UX 개선 효과

- 편집 중에도 보기 모드의 섹션 구조를 바로 확인할 수 있다.
- 내부 섹션 링크를 만들 때 사용자가 섹션 번호를 더 쉽게 이해한다.
- 좌측 섹션 목록과 본문 heading의 대응이 명확해진다.

### 주의점

- 실제 markdown 앞에 `1.1.` 텍스트를 삽입하면 안 된다. 저장 데이터가 오염된다.
- Toast UI Editor는 내부 DOM을 자주 다시 렌더링한다. `requestAnimationFrame` 또는 mutation timing을 고려해야 한다.
- heading 텍스트가 같은 경우 현재 `buildSectionTree()`는 번호 기반 id를 만든다. 편집 모드 장식도 같은 번호 계산을 써야 한다.
- 보기 모드의 anchor id와 섹션 번호 계산이 달라지면 내부 링크 이동이 깨질 수 있다.
- 에디터 내부 DOM을 직접 조작할 때 커서 위치/입력 흐름을 방해하면 안 된다.

## 3. 글자 크기 조정 UX 개선

### 현재 상태

업무 레벨:

- 사용자는 `Ctrl + Shift + F` 또는 `Ctrl + Numpad +`로 글자 크기 팝업을 열 수 있다.
- 선택한 텍스트에 크기를 적용할 수 있다.
- 하지만 크기가 적용된 텍스트가 편집 모드에서 한 덩어리처럼 취급된다.
- 예: `가나다`에 크기를 적용하면 이후 `다`만 따로 선택하기 어렵다.

소스 레벨:

- 편집 UI: `MarkdownEditor.jsx`
- 적용 함수: `applyInlineFontSize()`
- 저장 포맷:
  - `{{fs:14|가나다}}`
  - `{{14|가나다}}`
  - `{{lg|가나다}}`
- Toast UI widget 변환:
  - `src/features/wiki/wikiFontWidgetRules.js`
  - `widgetRules={fontWidgetRules}`
  - token 전체가 하나의 widget DOM으로 렌더링된다.
- 보기 모드 변환:
  - `src/features/wiki/wikiFontRender.js`
  - `{{fs:14|...}}`를 `<span class="wiki-font-custom" style="font-size:14px">...</span>`로 변환한다.

### 안전한 구현 방향

단기 개선:

- 기존 `{{fs:size|text}}` 저장 포맷은 유지한다.
- `Ctrl + Shift + F`는 유지한다.
- 툴바에 글자 크기 버튼 또는 드롭다운을 추가한다.
- 단기 개선은 접근성을 높이지만 "한 덩어리 선택" 문제는 완전히 해결하지 못한다.

근본 개선:

- widget token 방식 대신 inline span 방식으로 전환한다.
- 예: `<span style="font-size:14px">가나다</span>`
- 기존 문서에 남아 있는 `{{fs:...|...}}`는 계속 렌더링해야 한다.
- 신규 적용만 span 방식으로 할지, 기존 token도 마이그레이션할지 단계적으로 결정한다.

권장 순서:

1. 툴바 버튼 추가, 기존 token 방식 유지
2. 실제 사용성 확인
3. 그래도 부분 선택 문제가 크면 span 방식 실험
4. 기존 token 렌더링 호환 유지

### UX 개선 효과

- 단축키를 몰라도 툴바에서 글자 크기를 조정할 수 있다.
- 글자 크기 조정 기능이 다른 편집 기능과 같은 위치에 있어 발견성이 좋아진다.
- 장기적으로 span 방식으로 바꾸면 부분 선택과 재편집 경험이 자연스러워진다.

### 주의점

- `widgetRules` 방식은 token 전체를 하나의 위젯처럼 만든다. 부분 선택 문제의 핵심 원인이다.
- 기존 문서에는 이미 `{{fs:...|...}}`가 저장되어 있을 수 있다. 호환을 버리면 안 된다.
- Viewer, Trash preview, Excel export 모두 글자 크기 포맷과 연결되어 있다.
- inline HTML span을 저장하면 Toast UI sanitizer, Markdown 모드, WYSIWYG 모드, Excel export에서 모두 확인해야 한다.
- 글자 크기 기능을 toolbar에 붙이더라도 저장 포맷이 widget이면 한 덩어리 문제는 남는다.

## 4. 보기 렌더링/편집 렌더링 구조 정리

### 현재 상태

업무 레벨:

- 사용자는 편집 모드에서 markdown을 작성하고, 보기 모드에서 완성된 위키 문서 형태로 본다.
- 보기 모드에서는 내부 링크, 섹션 번호, 글자 크기 token이 변환되어 보인다.
- 편집 모드는 원본 markdown에 가까워서 보기 모드와 차이가 있다.

소스 레벨:

- 문서 상세 화면: `DocumentPage.jsx`
- 편집기: `MarkdownEditor.jsx`
- 내부 링크 보기 변환: `parseInternalLinks()`
- 글자 크기 보기 변환: `renderFontWidgetsInMarkdown()`
- 섹션 번호 보기 변환: `buildSectionTree()`
- 현재 보기 모드 변환 순서:
  1. `parseInternalLinks(content, allDocs)`
  2. `renderFontWidgetsInMarkdown(parsedMarkdown)`
  3. `buildSectionTree(renderedForView)`
  4. `<Viewer initialValue={markdownWithAnchors} />`

### 안전한 구현 방향

- 보기 모드 변환 pipeline을 명시적인 유틸 함수로 묶는 것을 검토한다.
- 예: `buildViewMarkdown({ markdown, documents })`
  - 내부 링크 변환
  - 글자 크기 변환
  - 섹션 번호/anchor 생성
  - headings 반환
- 단, 처음부터 큰 파일 분리를 하지 않는다.
- 먼저 `DocumentPage.jsx` 안에서 함수명을 명확히 하고 테스트 가능한 단위로 유지한다.
- 편집 모드 장식도 같은 heading 계산 규칙을 쓰게 만든다.

### UX 개선 효과

- 보기 모드와 편집 모드의 차이를 줄일 수 있다.
- 내부 링크/섹션 번호/글자 크기의 동작 기준이 명확해진다.
- 이후 기능 추가 시 특정 변환이 누락될 가능성이 줄어든다.

### 주의점

- 변환 순서가 중요하다.
  - 내부 링크 변환 전에 heading 번호를 붙이면 heading text 파싱이 달라질 수 있다.
  - 글자 크기 span 변환 후 heading 파싱을 하면 HTML tag 제거 로직과 충돌할 수 있다.
- `buildSectionTree()`는 anchor id를 만든다. 내부 링크 section href와 규칙이 반드시 같아야 한다.
- `updateSectionLinksForDocument()`는 섹션 번호 변경을 기존 `[[doc:id#number|label]]` 포맷 기준으로 보정한다.
- 보기용 markdown과 저장 markdown을 혼동하면 안 된다.
- Viewer에서 보이는 HTML을 다시 저장하면 안 된다.

## 권장 작업 순서

1. 내부 링크 UX 개선
   - 저장 포맷 유지
   - 후보 UI 개선
   - 툴바/버튼 삽입 경로 추가

2. 편집 모드 heading 번호 장식
   - 저장 markdown 불변
   - DOM decoration 방식
   - 보기 모드 번호 계산과 동일 규칙 사용

3. 글자 크기 툴바 버튼 추가
   - 기존 token 유지
   - 기능 발견성 개선

4. 글자 크기 저장 방식 개선 검토
   - widget token 한계 확인
   - span 방식 실험
   - 기존 token 호환 유지

5. 보기 렌더링 pipeline 정리
   - 큰 리팩터링보다 변환 순서 명시화 우선

## 작업 전 체크리스트

- 기존 문서의 `[[doc:id#section|label]]` 링크가 보기 모드에서 정상 이동하는지 확인한다.
- 섹션 번호가 보기 모드와 좌측 섹션 목록에서 동일한지 확인한다.
- 문서 저장 후 `content_markdown`에 보기용 HTML/번호가 섞이지 않는지 확인한다.
- 글자 크기 적용 문서가 보기 모드, 휴지통 미리보기, 엑셀 내보내기에서 깨지지 않는지 확인한다.
- `npm run lint`, `npm run build`를 통과해야 한다.
