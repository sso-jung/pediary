// src/features/wiki/wikiFontWidgetRules.js

// 공통 룰: {{lg|텍스트}}, {{md|텍스트}}, {{sm|텍스트}}, {{12|텍스트}}, {{fs:12|텍스트}}
function createFontRule() {
    return {
        // {{lg|...}}, {{12|...}}, {{fs:12|...}} 전부 잡기
        rule: /\{\{(?:fs:)?(sm|md|lg|\d+)\|([\s\S]+?)\}\}/,

        toDOM(text) {
            // 실제로 매칭 한 번 더
            const m = text.match(/\{\{(?:fs:)?(sm|md|lg|\d+)\|([\s\S]+?)\}\}/);

            const span = document.createElement('span');

            if (!m) {
                // 혹시나 매칭 실패하면 그냥 원문을 텍스트로 출력
                span.textContent = text;
                return span;
            }

            const sizeToken = m[1]; // 'sm' | 'md' | 'lg' | '12' 같은 거
            const inner = m[2] || '';

            let sizePx;
            if (sizeToken === 'sm') sizePx = 12;
            else if (sizeToken === 'md') sizePx = 14;
            else if (sizeToken === 'lg') sizePx = 18;
            else sizePx = Number(sizeToken) || 14; // 숫자면 그대로, 아니면 기본 14px

            span.textContent = inner;
            span.style.fontSize = `${sizePx}px`;
            span.className = 'wiki-font-custom';

            return span;
        },
    };
}

// 🔹 위젯 인덱스(0,1,2,...)가 여러 개일 수도 있어서, 같은 룰을 여러 번 채워 넣는다.
//   → $$widget0, $$widget1, ... 가 있어도 전부 fontRule 로 처리됨
export const fontWidgetRules = Array.from({ length: 8 }, () => createFontRule());
