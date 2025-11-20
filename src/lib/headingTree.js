// src/lib/headingTree.js
export function buildHeadingTree(markdown) {
    if (!markdown) return [];

    const lines = markdown.split('\n');
    const headings = [];

    for (const line of lines) {
        // # ~ ### 까지만 트리 대상으로 삼자 (필요하면 4,5,6도 확장 가능)
        const match = /^(#{1,3})\s+(.*)/.exec(line);
        if (!match) continue;

        const level = match[1].length; // # 개수 => 1, 2, 3
        const rawText = match[2].trim();

        // heading id용 slug 만들기 (한글도 어느정도 허용)
        const slug = rawText
            .toLowerCase()
            .replace(/[^\w가-힣\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        headings.push({
            level,      // 1, 2, 3
            text: rawText,
            id: slug,   // 나중에 scrollIntoView용
        });
    }

    // 번호 붙이기: [0,0,0] 카운터로 1, 1.1, 1.2.1 이런거 계산
    const counters = [0, 0, 0, 0]; // index 1~3 사용

    const withNumber = headings.map((h) => {
        counters[h.level] += 1;
        // 하위 레벨 카운터 초기화
        for (let i = h.level + 1; i < counters.length; i++) {
            counters[i] = 0;
        }

        const nums = counters.slice(1, h.level + 1).filter((n) => n > 0);
        const number = nums.join('.'); // "1", "1.2", "1.2.1"

        return {
            ...h,
            number,
        };
    });

    return withNumber;
}
