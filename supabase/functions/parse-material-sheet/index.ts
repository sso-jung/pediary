// supabase/functions/parse-material-sheet/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(supabaseUrl, serviceKey);

type MaterialExtractRequest = {
    userId?: string; // ✅ 여기 값이 오면 DB에 저장
    fileName: string;
    pdfText: string;
    existingColumns?: string[]; // 🔹 추가
};

function normalizeLabel(raw: string): string {
    if (!raw) return "";

    let s = raw.toLowerCase();

    // 유니코드 정규화 (° 같은 거)
    try {
        s = s.normalize("NFKD");
    } catch { /* ignore */ }

    // 악센트 제거
    s = s.replace(/[\u0300-\u036f]/g, "");

    // MD/TD 같이 방향 구분은 일단 제거해서 한 컬럼으로 취급
    // (만약 나중에 구분하고 싶으면 이 줄만 지우면 됨)
    s = s.replace(/md\/td/g, "");
    s = s.replace(/\bmd\b/g, "");
    s = s.replace(/\btd\b/g, "");

    // 괄호, @, ° 포함 거의 모든 특수문자/공백 제거
    s = s.replace(/[@°]/g, "");
    s = s.replace(/[^a-z0-9]+/g, ""); // 문자/숫자만 남김

    return s;
}

function mapToExistingLabel(label: string, existingColumns: string[]): string {
    if (!label || !existingColumns?.length) return label;

    const target = normalizeLabel(label);

    for (const col of existingColumns) {
        if (normalizeLabel(col) === target) {
            // 🔹 의미상 같은 컬럼이라고 보고, 기존 컬럼명을 그대로 사용
            return col;
        }
    }

    // 매칭되는 기존 컬럼이 없으면, 새 컬럼 그대로 사용
    return label;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: corsHeaders,
        });
    }

    try {
        const body = (await req.json()) as MaterialExtractRequest;
        const { fileName, pdfText, userId, existingColumns=[] } = body || {};

        console.log("existingColumns from client:", existingColumns);
        console.log("existingColumns length:", existingColumns.length);

        const existingColumnsSection =
            existingColumns.length > 0
                ? `
            [현재 이미 사용 중인 물성 컬럼 이름 목록]
            
            ${existingColumns.map((c) => `- ${c}`).join('\n')}
            
            [중요 규칙 - 물성 컬럼 이름 재사용]

아래 목록은 이미 데이터베이스에 저장된 "표준" 물성 컬럼 이름들이다.
새로운 물성 이름을 만들기 전에, 반드시 이 목록과 비교해서
재사용할 수 있는 이름이 있는지 확인해야 한다.

1. 새로운 물성 이름을 만들기 전에, 먼저 위 목록에서 **의미가 가장 비슷한 이름**을 찾아라.
2. 의미가 거의 같다면, 철자/띄어쓰기/대소문자/약어/괄호/기호 차이가 있더라도
   반드시 위 목록에 있는 이름을 그대로 key로 사용해야 한다.
   예)
   - "MFR", "Melt Flow Index", "Melt Mass-Flow Rate" → "Melt Flow Index"
   - "Density at 23 C", "Density@23°C", "Density (23°C)" → "Density @ 23°C"
   - "Gloss @ 45°", "Gloss (@ 45 °)" → "Gloss @ 45°"
3. "MD", "TD", "MD/TD"처럼 방향을 나타내는 정보는 **가능하면 value 쪽에 포함**하고,
   key 이름은 기존 컬럼 이름(예: "Tensile Strength @ Yield", "Elongation @ Break")을 그대로 재사용해라.
4. 위 목록과 의미가 명확히 다른 **완전히 새로운 종류의 물성**일 때만
   새로운 컬럼 이름을 만들어도 된다.
5. 비슷한 이름을 여러 개 만들지 말고, 가능한 한 기존 이름 하나에 합쳐라.
`
                : '';

        if (!fileName || !pdfText) {
            return new Response("fileName and pdfText are required", {
                status: 400,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/plain",
                },
            });
        }

        const prompt = `
너는 플라스틱 물성표(Technical Data Sheet, Product Data Sheet 등)를 읽고
표준화된 JSON으로 정리하는 도우미야.

[입력으로 주어진 전체 텍스트]
${pdfText}

${existingColumnsSection}

[물성 컬럼 이름 정규화 및 매칭 규칙]

새로운 물성 컬럼 이름을 만들기 전에, 아래 절차대로
"정규화된 이름"을 기준으로 기존 컬럼과 비교해야 한다.

1. 비교할 때는 아래와 같이 "정규화(normalize)된 문자열"을 사용한다.
   - 모두 소문자로 바꾼다.
   - 공백, 괄호 (), @, °, %, /, - 등 모든 구두점과 기호를 제거하고 비교한다.
   - "md", "td", "md/td" 와 같이 방향만 나타내는 토큰은 비교할 때 무시해도 된다.
2. 어떤 새로운 물성 이름과, 기존 컬럼 이름을 각각 정규화했을 때
   정규화된 문자열이 같다면, 두 컬럼은 같은 의미로 간주하고,
   **반드시 기존 컬럼 이름을 그대로 key로 사용해야 한다.**
3. 정규화 후에도 어떤 기존 컬럼과도 일치하지 않을 때에만
   새로운 컬럼 이름을 만들어도 된다.
4. 방향, 조건(예: MD/TD, 시험 조건 등)처럼 세부적인 차이는
   key가 아니라 value(값 문자열)에 포함해도 된다.
   
   [단위(Unit) 처리 규칙]

- UNIT 칸이 "-" 또는 빈 문자열("") 또는 공백(" ")이면 단위가 없는 것이다.
  → 이런 경우 value에는 단위를 붙이지 말고 값만 넣어라.
- UNIT이 실제 존재하는 경우에만 숫자 + 단위를 합쳐서 문자열로 넣어라.
- 절대로 "-"를 단위로 간주하지 마라.

[해야 할 일]

1. 텍스트를 보고 아래 항목들을 최대한 채워라.
   - materialName: 실제 제품명 또는 grade 이름 (예: "FB3003", "HD5502" 등)
   - brandName: 상표명 또는 브랜드명 (예: "Lotrène", "Lupolen" 등)
   - materialType: 재질 종류 (예: "Low Density Polyethylene", "HDPE", "PP random copolymer" 등)
   - originalFileName: 클라이언트에서 넘긴 파일명을 그대로 복사

2. 물성(property)들은 모두 "properties" 객체 안에 넣어라.
   - key: 사람이 읽기 좋은 속성 이름 (예: "Melt Flow Index", "Density @ 23°C", "Tensile Strength @ Yield MD", "Elongation at Break TD" 등)
   - value: 숫자 + 단위를 포함한 전체 문자열 (예: "0.30 g/10 min", "0.920 g/cm³", "14 / 11 MPa")

3. 물성표가 테이블이 여러 개여도 상관없다.
   의미 있는 물성 값이면 뭐든 properties에 추가해라.

4. 텍스트 안에서 "PRODUCTS", "DESCRIPTION", "PROPERTIES" 같은 섹션 타이틀은
   물질명으로 사용하지 마라.
   물질명은 항상 grade 이름이나 제품명(예: FB3003, M2004 등)이어야 한다.

5. 값이 전혀 없는 항목은 빼도 된다. null로 만들지 말고 그냥 keys에서 생략해라.

[출력 형식]
반드시 아래 형태의 JSON **한 개만** 출력해라.

{
  "materialName": "string",
  "brandName": "string | null",
  "materialType": "string | null",
  "originalFileName": "string",
  "properties": {
    "속성 이름": "값과 단위",
    "...": "..."
  }
}

앞뒤에 다른 설명 문장은 절대 붙이지 마라. JSON만 출력해라.
`;

        const geminiRes = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                    },
                }),
            },
        );

        if (!geminiRes.ok) {
            const text = await geminiRes.text();
            console.error("Gemini error", geminiRes.status, text);
            return new Response("Gemini API error", {
                status: 500,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/plain",
                },
            });
        }

        const geminiJson = await geminiRes.json();
        const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        let parsed: any;
        try {
            let cleaned = text.trim();

            if (cleaned.startsWith("```")) {
                cleaned = cleaned
                    .replace(/^```json\s*/i, "")
                    .replace(/^```\s*/i, "");
                const lastFence = cleaned.lastIndexOf("```");
                if (lastFence !== -1) {
                    cleaned = cleaned.slice(0, lastFence);
                }
                cleaned = cleaned.trim();
            }

            if (!cleaned.startsWith("{")) {
                const firstBrace = cleaned.indexOf("{");
                const lastBrace = cleaned.lastIndexOf("}");
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
                }
            }

            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.error("JSON parse error from Gemini:", e, text);
            return new Response(
                JSON.stringify({
                    error: "parse_failed",
                    raw: text,
                }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // ✅ 여기부터 DB 저장 로직 추가

        let sheetId: number | null = null;

        if (userId) {
            try {
                const materialName =
                    parsed.materialName || fileName.replace(/\.pdf$/i, "");
                const brandName = parsed.brandName ?? null;
                const pdfPath = fileName; // TODO: 나중에 Storage 경로를 넘기고 싶으면 body에 pdfPath 추가해서 사용

                // 1) material_sheets에 한 줄 insert
                const { data: sheet, error: sheetErr } = await supabase
                    .from("material_sheets")
                    .insert({
                        user_id: userId,
                        material_name: materialName,
                        brand_name: brandName,
                        pdf_path: pdfPath,
                    })
                    .select("id")
                    .single();

                if (sheetErr) {
                    console.error("insert material_sheets error:", sheetErr);
                } else {
                    sheetId = sheet.id;

                    // 2) properties를 material_properties에 여러 줄 insert
                    const propsObj = parsed.properties || {};
                    const entries = Object.entries(propsObj) as [string, any][];

                    if (entries.length > 0) {
                        const rowsToInsert = entries.map(([rawLabel, value]) => {
                            // 🔹 기존 컬럼 목록과 비교해서, 최대한 재사용
                            const mappedLabel = mapToExistingLabel(rawLabel, existingColumns);

                            return {
                                sheet_id: sheetId!,
                                property_key: mappedLabel,   // key/label 모두 매핑된 컬럼명 사용
                                property_label: mappedLabel,
                                value_text: String(value),
                                unit: null,
                            };
                        });

                        const { error: propErr } = await supabase
                            .from("material_properties")
                            .insert(rowsToInsert);

                        if (propErr) {
                            console.error("insert material_properties error:", propErr);
                        }
                    }
                }
            } catch (e) {
                console.error("DB insert error:", e);
                // DB 저장이 실패해도 클라이언트가 최소한 분석 결과는 받을 수 있게 함
            }
        } else {
            console.warn("userId is missing in request body, skip DB insert.");
        }

        // ✅ sheetId도 같이 돌려주면, 프론트에서 필요하면 써먹을 수 있음
        const responseBody = {
            ...parsed,
            sheetId,
        };

        return new Response(JSON.stringify(responseBody), {
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
            },
        });
    } catch (err) {
        console.error(err);
        return new Response("Internal error", {
            status: 500,
            headers: {
                ...corsHeaders,
                "Content-Type": "text/plain",
            },
        });
    }
});
