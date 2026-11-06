(function () {
    const { FORM_URL, CSV_URL } = window.REVIEWS_CONFIG || {};
    const list = document.getElementById("list");
    const state = document.getElementById("state");
    const cta = document.getElementById("leaveReview");

    if (FORM_URL) cta.href = FORM_URL;
    else cta.hidden = true;

    // --- CSV-парсер: поддерживает кавычки, запятые и переносы строк внутри ячеек ---
    function parseCSV(text) {
        const rows = [];
        let row = [], cell = "", quoted = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (quoted) {
                if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
                else if (ch === '"') quoted = false;
                else cell += ch;
            } else if (ch === '"') quoted = true;
            else if (ch === ",") { row.push(cell); cell = ""; }
            else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
            else if (ch !== "\r") cell += ch;
        }
        if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
        return rows;
    }

    // Ищем столбец по ключевым словам в заголовке, чтобы не зависеть от точной формулировки вопроса
    function findCol(headers, words) {
        return headers.findIndex(h => words.some(w => h.toLowerCase().includes(w)));
    }

    const APPROVED = ["да", "yes", "+", "true", "1", "✓", "✔"];

    function stars(n) {
        const wrap = document.createElement("span");
        wrap.className = "stars";
        wrap.setAttribute("aria-label", `Оценка ${n} из 5`);
        for (let i = 1; i <= 5; i++) {
            const s = document.createElement("span");
            s.textContent = "★";
            if (i > n) s.className = "off";
            wrap.appendChild(s);
        }
        return wrap;
    }

    function formatDate(raw) {
        // Google отдаёт дату как «07.11.2026 12:30:00» или «11/7/2026 12:30:00»
        const m = raw.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
        if (!m) return "";
        let [, a, b, y] = m;
        const day = raw.includes("/") ? b : a;
        const month = raw.includes("/") ? a : b;
        const d = new Date(+y, +month - 1, +day);
        return isNaN(d) ? "" : d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    }

    function card(r) {
        const el = document.createElement("article");
        el.className = "review";

        const head = document.createElement("div");
        head.className = "review-head";
        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = (r.name.trim()[0] || "?").toUpperCase();
        const who = document.createElement("div");
        const name = document.createElement("div");
        name.className = "review-name";
        name.textContent = r.name;
        const meta = document.createElement("div");
        meta.className = "review-meta";
        meta.textContent = [r.role, r.date].filter(Boolean).join(" · ");
        who.append(name, meta);
        head.append(avatar, who);
        el.appendChild(head);

        if (r.rating) el.appendChild(stars(r.rating));

        const text = document.createElement("p");
        text.className = "review-text";
        text.textContent = r.text;
        el.appendChild(text);

        if (r.project) {
            const p = document.createElement("span");
            p.className = "review-project";
            p.textContent = r.project;
            el.appendChild(p);
        }
        return el;
    }

    function showEmpty() {
        state.textContent = FORM_URL
            ? "Отзывов пока нет. Работали со мной? Станьте первым — это займёт минуту."
            : "Скоро здесь появятся отзывы клиентов.";
    }

    function render(reviews) {
        if (!reviews.length) return showEmpty();
        list.innerHTML = "";
        reviews.forEach(r => list.appendChild(card(r)));

        const rated = reviews.filter(r => r.rating);
        if (rated.length) {
            const avg = rated.reduce((s, r) => s + r.rating, 0) / rated.length;
            document.getElementById("avg").textContent = avg.toFixed(1).replace(".", ",");
            document.getElementById("avgStars").replaceWith(stars(Math.round(avg)));
            const n = reviews.length;
            const word = n % 10 === 1 && n % 100 !== 11 ? "отзыв"
                : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "отзыва" : "отзывов";
            document.getElementById("count").textContent = `${n} ${word}`;
            document.getElementById("summary").hidden = false;
        }
    }

    if (!CSV_URL) return showEmpty();

    fetch(CSV_URL + (CSV_URL.includes("?") ? "&" : "?") + "t=" + Date.now())
        .then(res => {
            if (!res.ok) throw new Error(res.status);
            return res.text();
        })
        .then(text => {
            const [headers = [], ...rows] = parseCSV(text);
            const col = {
                date: findCol(headers, ["отметка времени", "timestamp", "дата"]),
                name: findCol(headers, ["имя", "name"]),
                role: findCol(headers, ["кто вы", "компан", "должн", "бизнес"]),
                project: findCol(headers, ["проект", "заказ", "услуг"]),
                rating: findCol(headers, ["оцен", "rating"]),
                text: findCol(headers, ["отзыв", "review", "впечатл"]),
                ok: findCol(headers, ["одобр", "approved", "публик"])
            };
            const get = (row, i) => (i >= 0 && row[i] ? row[i].trim() : "");

            const reviews = rows
                .filter(row => APPROVED.includes(get(row, col.ok).toLowerCase()))
                .map(row => ({
                    name: get(row, col.name) || "Клиент",
                    role: get(row, col.role),
                    project: get(row, col.project),
                    rating: Math.max(0, Math.min(5, parseInt(get(row, col.rating), 10) || 0)),
                    text: get(row, col.text),
                    date: formatDate(get(row, col.date))
                }))
                .filter(r => r.text)
                .reverse(); // новые сверху

            render(reviews);
        })
        .catch(() => {
            state.textContent = "Не удалось загрузить отзывы. Попробуйте обновить страницу.";
        });
})();
