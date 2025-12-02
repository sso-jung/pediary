// src/features/wiki/hooks/useMaterialGrid.js
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/authStore';

const ADMIN_USER_IDS = [
    '1a39ccd8-775f-480e-a03a-a11d6a6cebe4',
    'ee98923e-c31e-4fcc-973f-5026bccb196b',
];

// 🔹 실제 만든 버킷 이름으로 바꿔줘
const PDF_BUCKET = 'material-pdfs';

function buildPdfUrl(pdfPath) {
    if (!pdfPath) return null;
    const { data } = supabase.storage.from(PDF_BUCKET).getPublicUrl(pdfPath);
    return data?.publicUrl ?? null;
}

export function useMaterialGrid() {
    const user = useAuthStore((s) => s.user);
    const [data, setData] = useState(null);   // { rows, columns }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0); // ✅ refetch 트리거용

    useEffect(() => {
        if (!user) return;

        const isAdmin = ADMIN_USER_IDS.includes(user.id);
        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                let query = supabase
                    .from('material_sheets')
                    .select(`
            id,
            user_id,
            material_name,
            brand_name,
            pdf_path,
            created_at,
            material_properties:material_properties (
              property_label,
              value_text
            )
          `)
                    .order('created_at', { ascending: false });

                if (!isAdmin) {
                    query = query.eq('user_id', user.id);
                }

                const { data: sheets, error: sheetErr } = await query;
                if (sheetErr) throw sheetErr;

                const safeSheets = sheets || [];

                // 1) 모든 컬럼(label) 수집
                const labelSet = new Set();
                for (const s of safeSheets) {
                    for (const p of s.material_properties || []) {
                        labelSet.add(p.property_label);
                    }
                }
                const dynamicColumns = Array.from(labelSet);

                // 2) 행 구성: sheet 1개 = row 1개
                const rows = safeSheets.map((s) => {
                    const propMap = new Map();
                    for (const p of s.material_properties || []) {
                        propMap.set(p.property_label, p.value_text);
                    }
                    return {
                        id: s.id,
                        ownerId: s.user_id,
                        materialName: s.material_name,
                        brandName: s.brand_name,
                        pdfPath: s.pdf_path,             // 파일명
                        pdfUrl: buildPdfUrl(s.pdf_path), // ✅ 여기서 Public URL 생성
                        props: propMap,
                    };
                });

                if (!cancelled) {
                    setData({
                        rows,
                        columns: dynamicColumns,
                    });
                }
            } catch (e) {
                console.error(e);
                if (!cancelled) setError(e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();
        return () => {
            cancelled = true;
        };
    }, [user, reloadKey]); // 🔹 reloadKey 바뀌면 다시 조회

    const refetch = () => setReloadKey((k) => k + 1);

    return { data, loading, error, refetch };
}
