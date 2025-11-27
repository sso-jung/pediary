/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50:  "#f4f8ff",
                    100: "#e3f2ff",
                    200: "#c7e4ff",
                    300: "#a2d1ff",
                    400: "#7ab8ff",
                    500: "#5a9eff",
                    600: "#3f7fe6",
                    700: "#315fb8",
                    800: "#274a8f",
                    900: "#223d73",
                },
                accent: {
                    100: "#ffe8ec",
                    200: "#ffcfd9",
                    300: "#ffb0c2",
                    400: "#ff8aa7",
                    500: "#ff5c86",
                },
                softbg: "#f8fafc",
            },
            borderRadius: {
                xl: "0.75rem",
                "2xl": "1rem",
            },
            boxShadow: {
                soft: "0 10px 30px rgba(15, 23, 42, 0.06)",
            },
        },
        screens: {
            sm: '640px',   // 모바일 → 작은 태블릿
            md: '768px',   // 일반 태블릿
            // ✅ 데스크탑 시작 기준을 1024 → 1360 으로 올림
            //    (갤럭시탭 S7+ 가로 1280px도 여전히 "태블릿 레이아웃"으로 남음)
            lg: '1420px',
            xl: '1536px',
        },
    },
    plugins: [],
};
