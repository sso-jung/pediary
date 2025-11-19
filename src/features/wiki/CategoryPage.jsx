// src/features/wiki/CategoryPage.jsx
import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useCategories } from './hooks/useCategories';
import { useDocuments } from './hooks/useDocuments';
import { useCreateDocument } from './hooks/useCreateDocument';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function CategoryPage() {
    const navigate = useNavigate();

    const { categoryId } = useParams();
    const numericCategoryId = Number(categoryId);

    const { data: categories } = useCategories();
    const { data: documents, isLoading } = useDocuments(numericCategoryId);
    const createDocumentMutation = useCreateDocument(numericCategoryId);

    const [newDocTitle, setNewDocTitle] = useState('');

    const currentCategory = categories?.find((c) => c.id === numericCategoryId);

    const handleCreateDocument = (e) => {
        e.preventDefault();
        const title = newDocTitle.trim();
        if (!title) return;

        createDocumentMutation.mutate(
            { title },
            {
                onSuccess: (newDoc) => {
                    setNewDocTitle('');
                    // 새 문서 생성 후 즉시 상세 페이지로 가고 싶으면:
                    // navigate(`/wiki/${newDoc.slug}`);
                },
            },
        );
    };

    return (
        <div className="space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-800">
                        {currentCategory ? currentCategory.name : '카테고리'}
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                        이 카테고리 안의 문서를 관리해 보자.
                    </p>
                </div>
            </div>

            {/* 문서 추가 폼 */}
            <form
                onSubmit={handleCreateDocument}
                className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-soft sm:flex-row"
            >
                <Input
                    placeholder="새 문서 제목"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                />
                <Button
                    type="submit"
                    className="shrink-0 sm:w-32"
                    disabled={createDocumentMutation.isLoading}
                >
                    {createDocumentMutation.isLoading ? '생성 중...' : '문서 추가'}
                </Button>
            </form>

            {/* 문서 목록 */}
            <div className="rounded-2xl bg-white p-4 shadow-soft">
                {isLoading ? (
                    <p className="text-sm text-slate-500">문서를 불러오는 중...</p>
                ) : !documents || documents.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        아직 이 카테고리에 문서가 없어. 위에서 새 문서를 추가해 보자.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {documents.map((doc) => (
                            <li
                                key={doc.id}
                                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-primary-50"
                            >
                                <div className="flex flex-col flex-1">
                                    {/* 제목 클릭 → 보기 모드 (mode 파라미터 없음) */}
                                    <Link
                                        to={`/wiki/${doc.slug}`}
                                        className="font-medium text-slate-800 hover:text-primary-600"
                                    >
                                        {doc.title}
                                    </Link>
                                    <span className="mt-0.5 text-[11px] text-slate-400">
                                      작성: {new Date(doc.created_at).toLocaleString()} · 수정:{' '}
                                                                    {new Date(doc.updated_at).toLocaleString()}
                                    </span>
                                </div>

                                {/* 우측에 '편집' 텍스트 */}
                                <button
                                    type="button"
                                    onClick={() => navigate(`/wiki/${doc.slug}?mode=edit`)}
                                    className="ml-3 text-xs text-slate-400 hover:text-slate-700"
                                >
                                    편집
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
