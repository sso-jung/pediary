import { useEffect, useRef, useState } from 'react';
import { useParams, Link as RouterLink, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useDocument } from './hooks/useDocument';
import { useUpdateDocument } from './hooks/useUpdateDocument';
import { useAllDocuments } from './hooks/useAllDocuments';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import { parseInternalLinks } from '../../lib/internalLinkParser';
import { useAuthStore } from '../../store/authStore';
import { logDocumentActivity } from '../../lib/wikiApi';

export default function DocumentPage() {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const user = useAuthStore((s) => s.user);

    const { data: doc, isLoading } = useDocument(slug);
    const { data: allDocs } = useAllDocuments();
    const updateMutation = useUpdateDocument(doc?.id, slug);
    const { showSnackbar } = useSnackbar();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const initialIsEditing = searchParams.get('mode') === 'edit';
    const [isEditing, setIsEditing] = useState(initialIsEditing);

    const viewLoggedRef = useRef(false);

    useEffect(() => {
        if (doc) {
            setTitle(doc.title || '');
            setContent(doc.content_markdown || '');
        }
    }, [doc]);

    useEffect(() => {
        const mode = searchParams.get('mode');
        setIsEditing(mode === 'edit');
    }, [searchParams]);

    useEffect(() => {
        if (!doc || !user || viewLoggedRef.current) return;

        viewLoggedRef.current = true;
        logDocumentActivity({
            userId: user.id,
            documentId: doc.id,
            action: 'viewed',
        });
    }, [doc, user]);

    const handleSave = (e) => {
        e.preventDefault();
        if (!doc) return;

        updateMutation.mutate(
            {
                title,
                contentMarkdown: content,
            },
            {
                onSuccess: () => {
                    showSnackbar('저장 완료!');
                    setIsEditing(false); // 저장 후 보기 모드로 전환
                },
                onError: () => {
                    showSnackbar('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
                },
            },
        );
    };

    if (isLoading || !doc) {
        return (
            <div className="text-sm text-slate-500">
                {isLoading ? '문서를 불러오는 중...' : '문서를 찾을 수 없습니다.'}
            </div>
        );
    }

    // 보기 모드용: 내부 링크 파싱 + Markdown 렌더링용 텍스트
    const parsedMarkdown = parseInternalLinks(doc.content_markdown || '', allDocs);

    return (
        <div className="space-y-4">
            {/* 상단 바: 제목 + 모드 전환 + 저장 버튼 */}
            <form
                onSubmit={handleSave}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
                <div className="flex-1">
                    {isEditing ? (
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="font-semibold text-slate-800"
                        />
                    ) : (
                        <h1 className="text-2xl font-semibold text-slate-800">
                            {doc.title}
                        </h1>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* 보기 / 편집 모드 탭 */}
                    <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-xs sm:text-sm">
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className={
                                'rounded-full px-3 py-1 transition ' +
                                (!isEditing
                                    ? 'bg-white text-slate-900 shadow'
                                    : 'text-slate-500 hover:text-slate-700')
                            }
                        >
                            보기
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className={
                                'rounded-full px-3 py-1 transition ' +
                                (isEditing
                                    ? 'bg-white text-slate-900 shadow'
                                    : 'text-slate-500 hover:text-slate-700')
                            }
                        >
                            편집
                        </button>
                    </div>

                    {/* 편집 모드일 때만 저장 버튼 노출 */}
                    {isEditing && (
                        <Button
                            type="submit"
                            className="sm:w-24"
                            disabled={updateMutation.isLoading}
                        >
                            {updateMutation.isLoading ? '저장 중...' : '저장'}
                        </Button>
                    )}
                </div>
            </form>

            {/* 내용 영역 */}
            <div className="rounded-2xl bg-white p-4 shadow-soft">
                {isEditing ? (
                    <textarea
                        className="h-[60vh] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-200"
                        placeholder="여기에 문서 내용을 마크다운 형식으로 작성해 보자."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                ) : (
                    // 보기 모드: Markdown 렌더링 + 내부 링크 처리
                    <article className="prose prose-sm max-w-none prose-slate">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                a: ({href, children}) => {
                                    // 내부 링크(/wiki/...)는 RouterLink로, 그 외는 기본 a 태그로
                                    if (href && href.startsWith('/wiki/')) {
                                        return (
                                            <RouterLink
                                                to={href}
                                                className="text-primary-600 hover:underline"
                                            >
                                                {children}
                                            </RouterLink>
                                        );
                                    }
                                    return (
                                        <a
                                            href={href}
                                            className="text-primary-600 hover:underline"
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {children}
                                        </a>
                                    );
                                },
                            }}
                        >
                            {parsedMarkdown}
                        </ReactMarkdown>
                    </article>
                )}
            </div>
        </div>
    );
}
