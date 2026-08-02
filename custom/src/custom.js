// Custom HAXcms additions: <quiz-user-auth>, <explode-quiz>, <quiz-dashboard>
// Self-contained vanilla web components. No external bare imports so the
// rollup "external" filter keeps the build self-contained.

// Shared helper: post JSON to a Google Apps Script URL (no-cors, fire-and-forget).
async function postJSON(url, payload) {
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    console.warn("postJSON failed", e);
    return false;
  }
}

// Shared helper: GET JSON from a Google Apps Script URL.
// Apps Script web apps return JSON when fetched with simple GET.
async function getJSON(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    // Apps Script sometimes returns JSON wrapped in a redirect; try parse first.
    try { return JSON.parse(text); } catch (_) {}
    // Some deployments return text that starts with )]}' or similar.
    const cleaned = text.replace(/^\)\]\}'?\n?/, "");
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("getJSON failed", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// <quiz-user-auth>
// A lightweight login / registration card that talks to a Google Apps Script.
// Attributes:
//   apps-script-url  (required) - the Apps Script web app URL
// Events:
//   quiz-user-auth:login  { detail: { user } }  - fired on successful login/register
// ---------------------------------------------------------------------------
class QuizUserAuth extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._user = null;
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this._url = this.getAttribute("apps-script-url") || "";

    const style = document.createElement("style");
    style.textContent = QuizUserAuth.styles;
    this.shadowRoot.appendChild(style);

    this._card = document.createElement("div");
    this._card.className = "auth-card";
    this.shadowRoot.appendChild(this._card);

    this._renderForm();
  }

  _renderForm() {
    this._card.innerHTML = "";
    const heading = document.createElement("h2");
    heading.className = "auth-title";
    heading.textContent = "Login / Registrasi";
    this._card.appendChild(heading);

    const form = document.createElement("form");
    form.className = "auth-form";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this._submit();
    });

    const nameField = this._field("name", "Nama", "text");
    const classField = this._field("class", "Kelas", "text");
    form.appendChild(nameField.wrap);
    form.appendChild(classField.wrap);

    const btnRow = document.createElement("div");
    btnRow.className = "auth-btns";
    const loginBtn = document.createElement("button");
    loginBtn.type = "submit";
    loginBtn.className = "auth-btn primary";
    loginBtn.textContent = "Masuk";
    btnRow.appendChild(loginBtn);
    form.appendChild(btnRow);

    this._card.appendChild(form);

    this._status = document.createElement("div");
    this._status.className = "auth-status";
    this._card.appendChild(this._status);
  }

  _field(id, label, type) {
    const wrap = document.createElement("label");
    wrap.className = "auth-field";
    const lab = document.createElement("span");
    lab.className = "auth-label";
    lab.textContent = label;
    const input = document.createElement("input");
    input.type = type;
    input.name = id;
    input.required = true;
    input.className = "auth-input";
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return { wrap, input };
  }

  async _submit() {
    const form = this._card.querySelector("form");
    const data = new FormData(form);
    const name = (data.get("name") || "").toString().trim();
    const klass = (data.get("class") || "").toString().trim();
    if (!name || !klass) {
      this._setStatus("Mohon isi nama dan kelas.", "error");
      return;
    }
    this._setStatus("Memproses...", "loading");
    const ok = await postJSON(this._url, {
      action: "login",
      name,
      class: klass,
    });
    if (ok) {
      this._user = { name, class: klass };
      this._setStatus(`Selamat datang, ${name}!`, "success");
      this.dispatchEvent(new CustomEvent("quiz-user-auth:login", {
        bubbles: true,
        composed: true,
        detail: { user: this._user },
      }));
      this._renderLoggedIn();
    } else {
      this._setStatus("Gagal terhubung. Coba lagi.", "error");
    }
  }

  _renderLoggedIn() {
    this._card.innerHTML = "";
    const heading = document.createElement("h2");
    heading.className = "auth-title";
    heading.textContent = `Halo, ${this._user.name}!`;
    this._card.appendChild(heading);

    const sub = document.createElement("div");
    sub.className = "auth-sub";
    sub.textContent = `Kelas: ${this._user.class}`;
    this._card.appendChild(sub);

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "auth-btn";
    logout.textContent = "Keluar";
    logout.addEventListener("click", () => {
      this._user = null;
      this._renderForm();
    });
    this._card.appendChild(logout);
  }

  _setStatus(msg, kind) {
    this._status.textContent = msg;
    this._status.className = `auth-status ${kind || ""}`;
  }

  get user() { return this._user; }

  static get styles() {
    return `
      :host { display: block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .auth-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); max-width: 420px; }
      .auth-title { margin: 0 0 14px; font-size: 1.25rem; color: #111827; }
      .auth-sub { color: #6b7280; margin-bottom: 12px; font-size: 0.9rem; }
      .auth-form { display: flex; flex-direction: column; gap: 12px; }
      .auth-field { display: flex; flex-direction: column; gap: 4px; }
      .auth-label { font-size: 0.82rem; font-weight: 600; color: #374151; }
      .auth-input { padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.95rem; }
      .auth-input:focus { outline: 2px solid #6366f1; border-color: transparent; }
      .auth-btns { display: flex; gap: 8px; }
      .auth-btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb; cursor: pointer; font-size: 0.92rem; font-weight: 600; color: #1f2937; }
      .auth-btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
      .auth-btn.primary:hover { background: #4338ca; }
      .auth-status { margin-top: 10px; font-size: 0.88rem; font-weight: 600; min-height: 1.2em; }
      .auth-status.loading { color: #6366f1; }
      .auth-status.success { color: #16a34a; }
      .auth-status.error { color: #dc2626; }
    `;
  }
}
customElements.define("quiz-user-auth", QuizUserAuth);

// ---------------------------------------------------------------------------
// <explode-quiz>
// A multiple-choice quiz with a confetti "explosion" on correct answers and
// a shake on wrong ones. Questions come from the `questions` JSON attribute
// OR are fetched from a Google Sheet via `apps-script-url` + `sheet-name`.
//
// Attributes:
//   questions        - JSON array of { question, choices[], correct }
//   apps-script-url  - Google Apps Script URL to fetch questions from
//   sheet-name       - sheet tab to read
//   quiz-category    - category filter (optional)
//   editable         - if present, shows an "Add question" editor
//   title            - quiz heading text
// ---------------------------------------------------------------------------
class ExplodeQuiz extends HTMLElement {
  constructor() {
    super();
    this._score = 0;
    this._answered = 0;
    this._total = 0;
    this._questions = [];
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;

    this._url = this.getAttribute("apps-script-url") || "";
    this._sheet = this.getAttribute("sheet-name") || "";
    this._category = this.getAttribute("quiz-category") || "";
    this._editable = this.hasAttribute("editable");
    this._title = this.getAttribute("title") || "Explode Quiz";

    const style = document.createElement("style");
    style.textContent = ExplodeQuiz.styles;
    this.shadowRoot.appendChild(style);

    this._wrap = document.createElement("div");
    this._wrap.className = "quiz-wrap";
    this.shadowRoot.appendChild(this._wrap);

    this._titleEl = document.createElement("h2");
    this._titleEl.className = "quiz-title";
    this._titleEl.textContent = this._title;
    this._wrap.appendChild(this._titleEl);

    this._stage = document.createElement("div");
    this._stage.className = "quiz-stage";
    this._wrap.appendChild(this._stage);

    this._scoreEl = document.createElement("div");
    this._scoreEl.className = "quiz-score";
    this._wrap.appendChild(this._scoreEl);

    // Load questions: prefer JSON attribute, fall back to sheet fetch.
    const raw = this.getAttribute("questions");
    if (raw) {
      try {
        this._questions = JSON.parse(raw);
        this._render();
      } catch (e) {
        this._error("Format JSON `questions` tidak valid.");
      }
    } else if (this._url) {
      this._loadFromSheet();
    } else {
      this._error("Tidak ada `questions` atau `apps-script-url`.");
    }
  }

  async _loadFromSheet() {
    this._loading("Memuat soal dari Google Sheets...");
    let url = `${this._url}?action=getQuestions&sheet=${encodeURIComponent(this._sheet)}`;
    if (this._category) url += `&category=${encodeURIComponent(this._category)}`;
    const data = await getJSON(url);
    if (data && Array.isArray(data.questions)) {
      this._questions = data.questions;
      this._render();
    } else if (data && Array.isArray(data)) {
      this._questions = data;
      this._render();
    } else {
      this._error("Gagal memuat soal dari sheet.");
    }
  }

  _loading(msg) {
    this._stage.innerHTML = `<div class="quiz-loading">${msg}</div>`;
  }

  _error(msg) {
    this._stage.innerHTML = `<div class="quiz-error">${msg}</div>`;
  }

  _render() {
    this._stage.innerHTML = "";
    this._total = this._questions.length;
    this._questions.forEach((q, idx) => this._renderQuestion(q, idx));
    this._updateScore();

    if (this._editable) this._renderEditor();
  }

  _renderQuestion(q, idx) {
    const prompt = q.question || q.prompt || "";
    const choices = q.choices || q.options || [];
    const correct = typeof q.correct === "number" ? q.correct : 0;

    const card = document.createElement("div");
    card.className = "quiz-card";
    card.dataset.index = String(idx);

    const qNum = document.createElement("div");
    qNum.className = "quiz-qnum";
    qNum.textContent = `Soal ${idx + 1} dari ${this._total}`;
    card.appendChild(qNum);

    const qText = document.createElement("div");
    qText.className = "quiz-qtext";
    qText.textContent = prompt;
    card.appendChild(qText);

    const optsWrap = document.createElement("div");
    optsWrap.className = "quiz-options";
    card.appendChild(optsWrap);

    choices.forEach((choice, oi) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.type = "button";
      btn.textContent = choice;
      btn.addEventListener("click", () => this._handleAnswer(card, btn, oi === correct, optsWrap, correct));
      optsWrap.appendChild(btn);
    });

    const feedback = document.createElement("div");
    feedback.className = "quiz-feedback";
    card.appendChild(feedback);

    this._stage.appendChild(card);
  }

  _handleAnswer(card, btn, isCorrect, optsWrap, correctIndex) {
    if (card.classList.contains("answered")) return;
    card.classList.add("answered");
    this._answered += 1;

    const feedback = card.querySelector(".quiz-feedback");
    if (isCorrect) {
      btn.classList.add("correct");
      this._score += 1;
      feedback.textContent = "Benar!";
      feedback.className = "quiz-feedback correct";
      this._explode(card);
    } else {
      btn.classList.add("wrong");
      feedback.textContent = "Belum tepat.";
      feedback.className = "quiz-feedback wrong";
      this._shake(card);
      // highlight the correct option
      const btns = optsWrap.querySelectorAll(".quiz-option");
      if (btns[correctIndex]) btns[correctIndex].classList.add("correct");
    }
    this._updateScore();
    this._reportAnswer(isCorrect);
  }

  _reportAnswer(isCorrect) {
    if (!this._url) return;
    const user = this._getUser();
    postJSON(this._url, {
      action: "submitAnswer",
      sheet: this._sheet,
      category: this._category,
      user,
      correct: isCorrect,
      score: this._score,
      total: this._total,
    });
  }

  _getUser() {
    const auth = document.querySelector("quiz-user-auth");
    return auth && auth.user ? auth.user : null;
  }

  _explode(card) {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ["#FF2222", "#22A7F0", "#F4D03F", "#27AE60", "#9B59B6", "#E67E22"];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "confetti";
      p.style.background = colors[i % colors.length];
      p.style.left = `${cx}px`;
      p.style.top = `${cy}px`;
      const angle = (Math.PI * 2 * i) / count;
      const dist = 80 + Math.random() * 120;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      p.style.setProperty("--dx", `${dx}px`);
      p.style.setProperty("--dy", `${dy}px`);
      p.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }

  _shake(card) {
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
  }

  _updateScore() {
    if (this._total === 0) { this._scoreEl.textContent = ""; return; }
    const done = this._answered >= this._total;
    this._scoreEl.textContent = done
      ? `Skor akhir: ${this._score} / ${this._total}`
      : `Skor: ${this._score} / ${this._total} — ${this._answered} terjawab`;
  }

  _renderEditor() {
    const editor = document.createElement("div");
    editor.className = "quiz-editor";
    const label = document.createElement("div");
    label.className = "quiz-editor-label";
    label.textContent = "Tambah soal (mode edit)";
    editor.appendChild(label);

    const qInput = document.createElement("textarea");
    qInput.placeholder = "Pertanyaan";
    qInput.className = "quiz-editor-q";
    editor.appendChild(qInput);

    const choicesInput = document.createElement("input");
    choicesInput.type = "text";
    choicesInput.placeholder = "Pilihan dipisah koma";
    choicesInput.className = "quiz-editor-choices";
    editor.appendChild(choicesInput);

    const correctInput = document.createElement("input");
    correctInput.type = "number";
    correctInput.min = "0";
    correctInput.placeholder = "Index jawaban benar (0-based)";
    correctInput.className = "quiz-editor-correct";
    editor.appendChild(correctInput);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Tambah soal";
    addBtn.className = "quiz-editor-btn";
    addBtn.addEventListener("click", () => {
      const q = qInput.value.trim();
      const choices = choicesInput.value.split(",").map((c) => c.trim()).filter(Boolean);
      const correct = parseInt(correctInput.value || "0", 10);
      if (!q || choices.length < 2) return;
      this._questions.push({ question: q, choices, correct });
      this._render();
    });
    editor.appendChild(addBtn);

    this._wrap.appendChild(editor);
  }

  get score() { return this._score; }
  get total() { return this._total; }
  get answered() { return this._answered; }

  static get styles() {
    return `
      :host { display: block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2933; }
      .quiz-wrap { max-width: 720px; margin: 0 auto; padding: 16px; }
      .quiz-title { font-size: 1.6rem; margin: 0 0 12px; color: #111827; }
      .quiz-stage { display: flex; flex-direction: column; gap: 16px; }
      .quiz-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: transform 0.15s ease; }
      .quiz-card.answered { opacity: 0.92; }
      .quiz-card.shake { animation: eq-shake 0.4s ease; }
      @keyframes eq-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
      .quiz-qnum { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 6px; }
      .quiz-qtext { font-size: 1.08rem; font-weight: 600; margin-bottom: 12px; color: #111827; }
      .quiz-options { display: flex; flex-direction: column; gap: 8px; }
      .quiz-option { appearance: none; cursor: pointer; text-align: left; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 0.98rem; color: #1f2937; transition: background 0.15s, border-color 0.15s, transform 0.08s; }
      .quiz-option:hover { background: #eef2ff; border-color: #6366f1; }
      .quiz-option:active { transform: scale(0.98); }
      .quiz-option.correct { background: #dcfce7; border-color: #16a34a; color: #14532d; }
      .quiz-option.wrong { background: #fee2e2; border-color: #dc2626; color: #7f1d1d; }
      .quiz-feedback { margin-top: 10px; font-size: 0.92rem; font-weight: 600; }
      .quiz-feedback.correct { color: #16a34a; }
      .quiz-feedback.wrong { color: #dc2626; }
      .quiz-score { margin-top: 18px; text-align: center; font-weight: 700; color: #374151; }
      .quiz-loading { padding: 24px; text-align: center; color: #6b7280; }
      .quiz-error { padding: 24px; text-align: center; color: #dc2626; font-weight: 600; }
      .quiz-editor { margin-top: 20px; padding: 16px; border: 1px dashed #cbd5e1; border-radius: 10px; display: flex; flex-direction: column; gap: 8px; }
      .quiz-editor-label { font-weight: 700; font-size: 0.9rem; color: #475569; }
      .quiz-editor-q, .quiz-editor-choices, .quiz-editor-correct { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; }
      .quiz-editor-btn { align-self: flex-start; padding: 8px 14px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
    `;
  }
}
customElements.define("explode-quiz", ExplodeQuiz);

// ---------------------------------------------------------------------------
// <quiz-dashboard>
// A live summary of all <explode-quiz> elements on the page: total questions,
// answered, correct, and a progress bar. Updates on every click in the document.
// ---------------------------------------------------------------------------
class QuizDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._quizzes = [];
    this._boundRefresh = this._refresh.bind(this);
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;

    const style = document.createElement("style");
    style.textContent = QuizDashboard.styles;
    this.shadowRoot.appendChild(style);

    this._card = document.createElement("div");
    this._card.className = "dash";
    this.shadowRoot.appendChild(this._card);

    this._heading = document.createElement("h2");
    this._heading.className = "dash-title";
    this._heading.textContent = this.getAttribute("title") || "Quiz Dashboard";
    this._card.appendChild(this._heading);

    this._statsRow = document.createElement("div");
    this._statsRow.className = "dash-stats";
    this._card.appendChild(this._statsRow);

    this._progressWrap = document.createElement("div");
    this._progressWrap.className = "dash-progress-wrap";
    this._progressBar = document.createElement("div");
    this._progressBar.className = "dash-progress-bar";
    this._progressWrap.appendChild(this._progressBar);
    this._card.appendChild(this._progressWrap);

    this._message = document.createElement("div");
    this._message.className = "dash-message";
    this._card.appendChild(this._message);

    this._scanQuizzes();
    setTimeout(() => { this._scanQuizzes(); this._refresh(); }, 0);
    document.addEventListener("click", this._boundRefresh, true);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._boundRefresh, true);
  }

  _scanQuizzes() {
    this._quizzes = Array.from(document.querySelectorAll("explode-quiz"));
  }

  _refresh() {
    this._scanQuizzes();
    let total = 0, answered = 0, score = 0;
    this._quizzes.forEach((q) => {
      total += q.total || 0;
      answered += q.answered || 0;
      score += q.score || 0;
    });

    this._statsRow.innerHTML = "";
    const stats = [
      { label: "Kuis", value: this._quizzes.length },
      { label: "Soal", value: total },
      { label: "Terjawab", value: answered },
      { label: "Benar", value: score },
    ];
    stats.forEach((s) => {
      const stat = document.createElement("div");
      stat.className = "dash-stat";
      const v = document.createElement("div");
      v.className = "dash-stat-value";
      v.textContent = String(s.value);
      const l = document.createElement("div");
      l.className = "dash-stat-label";
      l.textContent = s.label;
      stat.appendChild(v);
      stat.appendChild(l);
      this._statsRow.appendChild(stat);
    });

    const pct = total > 0 ? (answered / total) * 100 : 0;
    this._progressBar.style.width = `${pct}%`;

    if (total === 0) {
      this._message.textContent = "Belum ada kuis di halaman ini.";
    } else if (answered >= total && total > 0) {
      const pctScore = Math.round((score / total) * 100);
      this._message.textContent = `Selesai! Skor ${score} dari ${total} (${pctScore}%).`;
    } else {
      const rem = total - answered;
      this._message.textContent = `${rem} soal tersisa.`;
    }
  }

  static get styles() {
    return `
      :host { display: block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .dash { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(15,23,42,0.25); }
      .dash-title { margin: 0 0 18px; font-size: 1.4rem; font-weight: 700; }
      .dash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; margin-bottom: 18px; }
      .dash-stat { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 14px; text-align: center; }
      .dash-stat-value { font-size: 1.8rem; font-weight: 800; line-height: 1; }
      .dash-stat-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-top: 6px; }
      .dash-progress-wrap { height: 10px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; margin-bottom: 14px; }
      .dash-progress-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #22d3ee, #34d399); border-radius: 999px; transition: width 0.4s ease; }
      .dash-message { font-size: 0.95rem; color: #cbd5e1; font-weight: 600; }
    `;
  }
}
customElements.define("quiz-dashboard", QuizDashboard);

// Confetti particle styles (injected once into the document head)
if (!document.getElementById("explode-quiz-confetti-style")) {
  const cstyle = document.createElement("style");
  cstyle.id = "explode-quiz-confetti-style";
  cstyle.textContent = `
    .confetti { position: fixed; width: 10px; height: 10px; border-radius: 2px; pointer-events: none; z-index: 999999; transform: translate(-50%, -50%); animation: confetti-burst 1s ease-out forwards; }
    @keyframes confetti-burst { 0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)); opacity: 0; } }
  `;
  document.head.appendChild(cstyle);
}
