// supabase/functions/pediary-ai-summary/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ✅ CORS 헤더
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ⚠️ SERVICE_ROLE_KEY는 서버에서만 쓰는 강한 키라 반드시 Edge Function에서만 사용
const supabase = createClient(supabaseUrl, serviceKey);

// ───────────────────────────────────
// 타입 정의
// ───────────────────────────────────
type ActivitySummary = {
  createdCount: number;
  updatedCount: number;
  viewedCount: number;
  totalActions: number;
};

type DocLike = {
  id: number | string;
  title?: string | null;
  categoryId?: number | null;
  categoryName?: string | null; // 🔹 여기엔 "업무 / 회의" 같은 경로로 채움
  updatedAt?: string | null;
  content?: string | null;
  editCount?: number | null;
};

type BuildPromptArgs = {
  userName: string;
  activitySummary: ActivitySummary;
  docs: DocLike[];
};

// 🔹 updated 로그를 “30분 세션” 기준으로 묶어서 통계 만드는 함수
type UpdateSessionStat = { sessions: number; lastTime: number | null };

function buildUpdateSessionStats(
  recentActivity: any[] | undefined | null,
  sessionMs = 30 * 60 * 1000, // 30분
): Map<string | number, UpdateSessionStat> {
  const stats = new Map<string | number, UpdateSessionStat>();

  if (!Array.isArray(recentActivity)) return stats;

  // updated 로그만 뽑아서 시간순 정렬
  const updates = recentActivity
    .filter(
      (a) =>
        a &&
        a.action === "updated" &&
        a.created_at &&
        a.document_id != null,
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime(),
    );

  for (const u of updates) {
    const docId = u.document_id as string | number;
    const t = new Date(u.created_at).getTime();
    if (Number.isNaN(t)) continue;

    const stat = stats.get(docId) || { sessions: 0, lastTime: null };

    // 첫 수정이거나, 마지막 수정으로부터 sessionMs(30분) 이상 지나면 새 세션
    if (!stat.lastTime || t - stat.lastTime > sessionMs) {
      stat.sessions += 1;
    }

    stat.lastTime = t;
    stats.set(docId, stat);
  }

  return stats;
}

// 🔹 카테고리 경로 문자열 만들기 (부모/자식)
function buildCategoryPath(category: any | null | undefined): string | null {
  if (!category) return null;

  // Postgrest nested: category: { id, name, parent: { id, name } }
  const name: string | undefined = category.name ?? undefined;
  const parentName: string | undefined = category.parent?.name ?? undefined;

  if (parentName && name) return `${parentName} / ${name}`;
  if (name) return name;
  if (parentName) return parentName;
  return null;
}

// ───────────────────────────────────
// 메인 핸들러
// ───────────────────────────────────
serve(async (req) => {
  // ✅ 프리플라이트(OPTIONS) 처리
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
    const body = await req.json();
    const { userId, userName, recentActivity, recentDocs, topEditedDocs } =
      body || {};

    if (!userId) {
      return new Response("userId is required", {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
        },
      });
    }

    // 🔹 updated 로그에 대해 “30분 세션” 통계 먼저 계산
    const updateSessionStats = buildUpdateSessionStats(recentActivity);

    // 🔹 recentActivity를 요약 숫자로만 변환 (수정은 세션 기준)
    const activitySummary: ActivitySummary = (() => {
      if (!Array.isArray(recentActivity)) {
        return {
          createdCount: 0,
          updatedCount: 0,
          viewedCount: 0,
          totalActions: 0,
        };
      }

      // created / viewed 는 그대로 개수
      const createdEvents = recentActivity.filter(
        (a) => a && a.action === "created",
      );
      const viewedEvents = recentActivity.filter(
        (a) => a && a.action === "viewed",
      );

      const createdCount = createdEvents.length;
      const viewedCount = viewedEvents.length;

      // updated 는 세션 수의 합
      let updatedSessionCount = 0;
      for (const stat of updateSessionStats.values()) {
        updatedSessionCount += stat.sessions;
      }

      const totalActions =
        createdCount + viewedCount + updatedSessionCount;

      return {
        createdCount,
        updatedCount: updatedSessionCount,
        viewedCount,
        totalActions,
      };
    })();

    // 🔹 recentDocs: 최대 10개 (클라이언트에서 보낼 수도 있으니 그대로 사용 가능)
    const trimmedRecentDocs: DocLike[] = Array.isArray(recentDocs)
      ? recentDocs.slice(0, 10)
      : [];

    // 🔹 topEditedDocs: 들어오더라도, 여기서 “세션 기준 editCount” 로 다시 계산
    const computedTopEdited: DocLike[] = (() => {
      if (updateSessionStats.size === 0) return [];

      const result: DocLike[] = [];

      for (const [docId, stat] of updateSessionStats.entries()) {
        // 우선 recentDocs 안에서 이 문서 정보 찾아보고
        const fromRecent =
          trimmedRecentDocs.find((d) => d.id === docId) || null;

        // 혹시 body.topEditedDocs 에도 정보가 있으면 fallback 용으로 사용
        const fromBodyTop =
          (Array.isArray(topEditedDocs)
            ? topEditedDocs.find((d: any) => d.id === docId)
            : null) || null;

        const base = fromRecent || fromBodyTop;

        result.push({
          id: docId,
          title: base?.title ?? null,
          categoryId: base?.categoryId ?? null,
          categoryName: base?.categoryName ?? null,
          updatedAt: base?.updatedAt ?? null,
          content: base?.content ?? null,
          editCount: stat.sessions, // ✅ 세션 기준 수정 횟수
        });
      }

      return result
        .sort(
          (a, b) =>
            (b.editCount ?? 0) - (a.editCount ?? 0),
        )
        .slice(0, 5);
    })();

    // 🔹 recentDocs + (세션 기준) topEditedDocs 를 id 기준으로 머지 & 중복 제거
    const mergedDocs: DocLike[] = (() => {
      const map = new Map<string | number, DocLike>();

      for (const d of trimmedRecentDocs) {
        if (!d || d.id == null) continue;
        map.set(d.id, d);
      }

      for (const d of computedTopEdited) {
        if (!d || d.id == null) continue;
        if (!map.has(d.id)) {
          map.set(d.id, d);
        } else {
          // 이미 recentDocs 에 있는 경우, editCount 등은 덮어쓰기
          const existing = map.get(d.id)!;
          map.set(d.id, { ...existing, ...d });
        }
      }

      return Array.from(map.values());
    })();

    // 🔹 여기서 문서 메타데이터를 Supabase에서 가져와서 title / content / 카테고리 경로 채워넣기
    let enrichedDocs: DocLike[] = mergedDocs;

    if (mergedDocs.length > 0) {
      const docIds = mergedDocs
        .map((d) => d.id)
        .filter((id) => id !== null && id !== undefined);

      try {
        const { data: docsMeta, error: docsError } = await supabase
          .from("documents")
          .select(`
            id,
            title,
            content_markdown,
            updated_at,
            category_id,
            category:category_id (
              id,
              name,
              parent_id,
              parent:parent_id (
                id,
                name
              )
            )
          `)
          .in("id", docIds as any[]);

        if (docsError) {
          console.error("docs meta fetch error", docsError);
        } else if (docsMeta && docsMeta.length > 0) {
          const metaMap = new Map<any, any>(
            docsMeta.map((m: any) => [m.id, m]),
          );

          enrichedDocs = mergedDocs.map((d) => {
            const meta = metaMap.get(d.id);

            if (!meta) return d;

            const catPath = buildCategoryPath(meta.category);

            return {
              ...d,
              title: meta.title ?? d.title ?? null,
              content: meta.content_markdown ?? d.content ?? null,
              updatedAt: meta.updated_at ?? d.updatedAt ?? null,
              categoryId: meta.category_id ?? d.categoryId ?? null,
              // 🔹 "부모 / 자식" 형식의 카테고리 경로를 categoryName에 넣어줌
              categoryName: catPath ?? d.categoryName ?? null,
            };
          });
        }
      } catch (e) {
        console.error("docs meta fetch exception", e);
      }
    }

    // 1️⃣ 최소 문서 수 체크 (deleted 아닌 문서 기준)
    const { count: docCount, error: countError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (countError) {
      console.error("documents count error", countError);
    }

    const minDocsRequired = 3;
    if (!docCount || docCount < minDocsRequired) {
      // Gemini 호출 없이, 서버에서 직접 메시지만 만들어서 반환
      const payload = {
        focusSummary: {
          workPercent: 0,
          lifePercent: 0,
          hobbyPercent: 0,
          comment: "아직 패턴을 읽어낼 만큼 문서가 많지 않아.",
        },
        // ✅ 문서가 적을 때 추천 체크리스트 추가
        checklist: [
          {
            text: "피디어리에 글을 남겨 보자!",
            reason: "",
          },
        ],
        pediaryMessage: {
          text:
            "아직 작성된 문서가 3개 미만이라, 지금은 제대로 분석해주기 어려워." +
            "\n" +
            "조금만 더 자유롭게 생각나는 대로 글을 써봐 줘. \n업무 이야기든, 일상 기록이든, " +
            "요즘 빠져 있는 취미든 뭐든 좋아. \n네가 남긴 흔적이 많아질수록, 피디어리가 해줄 수 있는 " +
            "이야기도 훨씬 풍성해질 거야.",
        },
        meta: {
          reason: "not_enough_documents",
          minDocsRequired,
          currentDocs: docCount ?? 0,
        },
      };

      return new Response(JSON.stringify(payload), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 2️⃣ 12시간 이내 캐시가 있으면 그대로 반환
    const twelveHoursAgo = new Date(
      Date.now() - 12 * 60 * 60 * 1000,
    ).toISOString();

    const { data: cached, error: cacheError } = await supabase
      .from("ai_daily_summaries")
      .select("id, payload, created_at")
      .eq("user_id", userId)
      .gte("created_at", twelveHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheError) {
      console.error("cache error", cacheError);
    }

    if (cached && cached.payload) {
      const payload = cached.payload;
      // meta 필드가 없을 수도 있으니 보정
      payload.meta = {
        ...(payload.meta || {}),
        fromCache: true,
        cachedAt: cached.created_at,
      };

      return new Response(JSON.stringify(payload), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 3️⃣ 캐시가 없으면 Gemini 호출
    const prompt = buildPrompt({
      userName,
      activitySummary,
      docs: enrichedDocs, // 🔹 카테고리 경로까지 포함된 버전 사용
    });

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
          // ✅ JSON으로만 응답해 달라고 힌트 주기
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

    let parsed;
    try {
      // ✅ 1차: 코드블록( ```json ... ``` ) 벗겨내기
      let cleaned = text.trim();

      if (cleaned.startsWith("```")) {
        // ```json 혹은 ``` 로 시작하는 부분 제거
        cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");

        // 마지막 ``` 제거
        const lastFence = cleaned.lastIndexOf("```");
        if (lastFence !== -1) {
          cleaned = cleaned.slice(0, lastFence);
        }

        cleaned = cleaned.trim();
      }

      // ✅ 2차: 혹시 앞뒤에 이상한 문구가 섞여 있으면,
      // 첫 '{' 부터 마지막 '}' 까지만 잘라서 다시 시도
      let jsonCandidate = cleaned;
      if (!cleaned.startsWith("{")) {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonCandidate = cleaned.slice(firstBrace, lastBrace + 1);
        }
      }

      parsed = JSON.parse(jsonCandidate);
    } catch (e) {
      console.error("JSON parse error from Gemini:", e, text);

      // ✅ 그래도 안 되면 fallback 사용
      parsed = {
        focusSummary: {
          workPercent: 0,
          lifePercent: 0,
          hobbyPercent: 0,
          comment: "AI 응답을 제대로 읽지 못했어.",
        },
        checklist: [],
        pediaryMessage: {
          text: text.slice(0, 500),
        },
      };
    }

    const finalPayload = {
      ...parsed,
      meta: {
        ...(parsed.meta || {}),
        fromCache: false,
        cachedAt: null,
      },
    };

    // 4️⃣ 새 결과 캐시에 저장
    const { error: insertError } = await supabase
      .from("ai_daily_summaries")
      .insert({
        user_id: userId,
        payload: finalPayload,
      });

    if (insertError) {
      console.error("ai_daily_summaries insert error", insertError);
    }

    return new Response(JSON.stringify(finalPayload), {
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

/**
 * 긴 문서를 그대로 다 보내지 않고,
 * - 짧으면 전체 내용
 * - 길면 앞부분 + 뒷부분을 잘라서 보내기
 */
function buildExcerpt(content: string, maxLen = 1600): string {
  if (!content) return "";

  const text = content.toString();

  if (text.length <= maxLen) {
    return text;
  }

  // 예: 60% 앞 / 40% 뒤
  const headLen = Math.floor(maxLen * 0.6);
  const tailLen = maxLen - headLen;

  const head = text.slice(0, headLen);
  const tail = text.slice(-tailLen);

  return `[문서 앞부분]\n${head}\n\n[최근 내용(뒷부분)]\n${tail}`;
}

// 🔹 프롬프트 빌더
function buildPrompt({
  userName,
  activitySummary,
  docs,
}: BuildPromptArgs): string {
  const { createdCount, updatedCount, viewedCount, totalActions } =
    activitySummary;

  return `
너는 "피디어리(Pediary)"라는 개인 위키/다이어리 서비스의 전용 AI 비서야.

[사용자 이름]
${userName || "사용자"}

[최근 활동량 요약]
- 새로 쓴 문서 수: ${createdCount}
- 수정한 문서 수(30분 단위 세션): ${updatedCount}
- 열어본 문서 수: ${viewedCount}
- 총 활동 횟수(세션 기준): ${totalActions}

[최근에 자주 다뤄진 문서들]
${(docs || [])
  .map(
    (d, idx) => `
# 문서 ${idx + 1}
제목: ${d.title}
문서 ID: ${d.id}
카테고리 ID: ${d.categoryId ?? "null"}
카테고리 이름(경로): ${d.categoryName ?? "알 수 없음"}
수정일: ${d.updatedAt ?? "알 수 없음"}
수정 세션 수: ${d.editCount ?? "알 수 없음"}
내용 일부:
${buildExcerpt(d.content || "")}
`,
  )
  .join("\n")}

[목표]
1. 위 문서들과 활동량을 기반으로, 사용자의 관심사를
   - 업무 위주 / 일상 위주 / 취미 위주
   세 가지 비율로 퍼센트 값으로 추정해라.
2. 문서 내용 속에서 "해야 할 일"로 만들 수 있는 부분이 있으면
   구체적인 체크리스트 항목으로 최대 5개까지 작성해라.
3. 해야 할 일이 거의 없다면,
   체크리스트는 0~2개 이내로만 작성하고,
   대신 사용자의 현재 상태를 정리해주고 응원/조언 중심으로 써라.
4. 마지막으로 "피디어리의 한 마디"라는 이름의 조언 문장을
   최소 150자, 최대 450자 정도로 작성해라.
   - 너무 진단적이거나 의학/치료/약물 관련 조언은 절대 하지 마라.
   - 사용자를 비난하지 말고, 다정하지만 현실적인 톤으로 이야기해라.
   - 한국어 반말로 작성해라.

[출력 형식 - 반드시 아래 JSON만 출력할 것]
{
  "focusSummary": {
    "workPercent": number,
    "lifePercent": number,
    "hobbyPercent": number,
    "comment": "string"
  },
  "checklist": [
    {
      "text": "해야 할 일 한 줄",
      "reason": "이걸 왜 해야 하는지 한 줄 설명"
    }
  ],
  "pediaryMessage": {
    "text": "150~350자 정도의 응원/조언"
  }
}
JSON 이외의 다른 텍스트는 절대 출력하지 마라.
`;
}
