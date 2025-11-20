import { useEffect, useRef } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';

export default function MarkdownEditor({ value, onChange }) {
    const editorRef = useRef(null);

    // 외부에서 content가 바뀌었을 때 에디터도 동기화
    useEffect(() => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const current = instance.getMarkdown();
        if ((value || '') !== current) {
            instance.setMarkdown(value || '');
        }
    }, [value]);

    const handleChange = () => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;
        const markdown = instance.getMarkdown(); // DB에는 계속 markdown으로 저장
        onChange(markdown);
    };

    // 🔹 선택된 텍스트를 정렬 블록으로 감싸는 함수
    const wrapSelectionWithAlign = (alignType) => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const selected = instance.getSelectedText();
        const text = selected && selected.length > 0
            ? selected
            : '여기에 내용을 입력하세요';

        const block = `:::${alignType}\n${text}\n:::\n`;

        instance.replaceSelection(block);
        instance.focus();
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white">
            {/* 🔹 상단 커스텀 정렬 버튼 바 */}
            <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                <span className="mr-1 text-[11px] text-slate-500">정렬:</span>
                <button
                    type="button"
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 hover:bg-slate-100"
                    onClick={() => wrapSelectionWithAlign('left')}
                >
                    왼쪽
                </button>
                <button
                    type="button"
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 hover:bg-slate-100"
                    onClick={() => wrapSelectionWithAlign('center')}
                >
                    가운데
                </button>
                <button
                    type="button"
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 hover:bg-slate-100"
                    onClick={() => wrapSelectionWithAlign('right')}
                >
                    오른쪽
                </button>
                <button
                    type="button"
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 hover:bg-slate-100"
                    onClick={() => wrapSelectionWithAlign('justify')}
                >
                    양쪽
                </button>
                <span className="ml-2 text-[10px] text-slate-400">
                    텍스트 드래그 후 버튼을 누르면 정렬 블록이 적용돼.
                </span>
            </div>

            {/* 🔹 Toast UI Editor 본체 */}
            <Editor
                ref={editorRef}
                initialValue={value || ''}
                previewStyle="vertical"
                height="700px"              // 위에 버튼바 추가돼서 살짝 줄임 (원하면 다시 730px로)
                initialEditType="wysiwyg"   // 편집창에서 바로 스타일 보이는 모드
                hideModeSwitch={true}       // 하단 Markdown/WYSIWYG 탭 숨김
                useCommandShortcut={true}
                toolbarItems={[
                    ['heading', 'bold', 'italic', 'strike'],
                    ['hr', 'quote'],
                    ['ul', 'ol', 'task'],
                    ['link'],
                    ['code', 'codeblock'],
                ]}
                onChange={handleChange}
            />
        </div>
    );
}
