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

    return (
        <div className="rounded-xl border border-slate-200 bg-white">
            <Editor
                ref={editorRef}
                initialValue={value || ''}
                previewStyle="vertical"
                height="730px"
                initialEditType="wysiwyg"       // ✅ 편집창에서 바로 굵게/목록 스타일로 보이는 모드
                hideModeSwitch={true}           // 하단 Markdown/WYSIWYG 탭 숨김
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
