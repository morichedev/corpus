/* ── Constants ──────────────────────────────────────────────────────────────── */
const PLATFORMS = ["TikTok", "Instagram", "WhatsApp"];

const PLATFORM_COLORS = {
  TikTok:    { solid: "#fe2c55", light: "rgba(254,44,85,0.8)" },
  Instagram: { solid: "#c13584", light: "rgba(193,53,132,0.8)" },
  WhatsApp:  { solid: "#25d366", light: "rgba(37,211,102,0.8)" },
};

const DEFAULT_COLOR = { solid: "#6366f1", light: "rgba(99,102,241,0.8)" };

const PALETTE = [
  "#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6",
  "#06b6d4", "#84cc16", "#e11d48", "#0ea5e9", "#d946ef",
];

/* ── State ──────────────────────────────────────────────────────────────────── */
let DATA = [];
let chartType = "bar";
let chartInstance = null;

/* ── Data loading ───────────────────────────────────────────────────────────── */
async function loadData() {
  const wrapper = document.querySelector(".chart-wrapper");
  wrapper.innerHTML = '<div class="loading-state">Cargando datos…</div>';

  try {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    DATA = raw.map((r) => ({
      p: r.p,
      a: r.a.toLowerCase().trim(),
      f: r.f,
    }));
    initUI();
    renderChart();
  } catch (err) {
    wrapper.innerHTML = `<div class="error-state">Error al cargar los datos: ${err.message}</div>`;
  }
}

/* ── UI initialisation ──────────────────────────────────────────────────────── */
function initUI() {
  // Build anglicismo index
  const angCount = {};
  DATA.forEach((r) => { angCount[r.a] = (angCount[r.a] || 0) + 1; });

  const allAngs = Object.entries(angCount)
    .sort((a, b) => b[1] - a[1])
    .map((e) => e[0]);

  // Populate dropdown
  const angSelect = document.getElementById("anglicismFilter");
  angSelect.innerHTML = '<option value="">Ver ranking general</option>';
  allAngs.forEach((ang) => {
    const opt = document.createElement("option");
    opt.value = ang;
    opt.textContent = `${ang} (${angCount[ang]})`;
    angSelect.appendChild(opt);
  });

  // Update header pills with real counts
  const uniqueCount = allAngs.length;
  const totalCount = DATA.length;
  document.querySelectorAll(".pill").forEach((pill) => {
    const span = pill.querySelector("span");
    if (!span) return;
    const text = pill.textContent.trim();
    if (text.includes("ocurrencias")) span.textContent = totalCount;
    if (text.includes("únicos"))      span.textContent = uniqueCount;
  });
}

/* ── Filters helper ─────────────────────────────────────────────────────────── */
function getFilters() {
  return {
    platform:  document.getElementById("platformFilter").value,
    anglicism: document.getElementById("anglicismFilter").value,
    topN:      parseInt(document.getElementById("topN").value, 10),
  };
}

/* ── Chart data computation ─────────────────────────────────────────────────── */
function computeChartData({ platform, anglicism, topN }) {
  // Specific anglicism → distribution across platforms
  if (anglicism) {
    const filtered = DATA.filter((r) => r.a === anglicism);
    if (platform) return null; // both filters active: no chart

    const counts = {};
    PLATFORMS.forEach((p) => { counts[p] = 0; });
    filtered.forEach((r) => { counts[r.p] = (counts[r.p] || 0) + 1; });

    return {
      labels: PLATFORMS,
      datasets: [{
        label: anglicism,
        data: PLATFORMS.map((p) => counts[p]),
        backgroundColor: PLATFORMS.map((p) => PLATFORM_COLORS[p].light),
        borderColor:     PLATFORMS.map((p) => PLATFORM_COLORS[p].solid),
        borderWidth: 2,
        borderRadius: 8,
        pointBackgroundColor: PLATFORMS.map((p) => PLATFORM_COLORS[p].solid),
        pointRadius: 6,
        fill: false,
        tension: 0.4,
      }],
      title:    `«${anglicism}» por red social`,
      subtitle: `Distribución de ${filtered.length} ocurrencias entre las 3 plataformas`,
    };
  }

  // Ranking mode
  const filtered = platform ? DATA.filter((r) => r.p === platform) : DATA;
  const counts = {};
  filtered.forEach((r) => { counts[r.a] = (counts[r.a] || 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN);
  const labels = sorted.map((e) => e[0]);
  const values = sorted.map((e) => e[1]);

  const bgColors = chartType === "doughnut"
    ? PALETTE.slice(0, labels.length)
    : labels.map((_, i) => PALETTE[i % PALETTE.length] + "d9");

  return {
    labels,
    datasets: [{
      label: "Ocurrencias",
      data: values,
      backgroundColor: bgColors,
      borderColor:  PALETTE.slice(0, labels.length),
      borderWidth: 2,
      borderRadius: chartType !== "doughnut" ? 8 : 0,
      pointBackgroundColor: (platform ? PLATFORM_COLORS[platform] : DEFAULT_COLOR).solid,
      pointRadius: 5,
      fill: false,
      tension: 0.4,
    }],
    title: platform
      ? `Top ${topN} anglicismos en ${platform}`
      : `Top ${topN} anglicismos más usados`,
    subtitle: platform
      ? `De un total de ${filtered.length} ocurrencias en ${platform}`
      : `De un total de ${DATA.length} ocurrencias en todo el corpus`,
  };
}

/* ── Chart render ───────────────────────────────────────────────────────────── */
function renderChart() {
  const filters = getFilters();
  const { platform, anglicism } = filters;

  document.getElementById("topNWrapper").style.display = anglicism ? "none" : "flex";

  const chartData = computeChartData(filters);

  if (!chartData) {
    document.getElementById("chartTitle").textContent =
      `Filtros activos: «${anglicism}» en ${platform}`;
    document.getElementById("chartSubtitle").textContent =
      "Selecciona solo un filtro para ver el gráfico";
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    document.querySelector(".chart-wrapper").innerHTML =
      '<div class="empty-state">Selecciona solo la red social <em>o</em> el anglicismo para ver el gráfico.<br>Con ambos activos, consulta los ejemplos de abajo.</div>';
    renderExamples(filters);
    return;
  }

  document.getElementById("chartTitle").textContent    = chartData.title;
  document.getElementById("chartSubtitle").textContent = chartData.subtitle;

  // Ensure canvas exists
  const wrapper = document.querySelector(".chart-wrapper");
  if (!wrapper.querySelector("canvas")) {
    wrapper.innerHTML = '<canvas id="mainChart"></canvas>';
  }

  const ctx = document.getElementById("mainChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  const isHorizontal = chartType === "bar" && chartData.labels.length > 8;
  const actualType   = chartType === "doughnut" ? "doughnut" : (isHorizontal ? "bar" : chartType);

  chartInstance = new Chart(ctx, {
    type: actualType,
    data: { labels: chartData.labels, datasets: chartData.datasets },
    options: {
      indexAxis: isHorizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: chartType === "doughnut",
          position: "right",
          labels: { padding: 12, font: { size: 12 }, boxWidth: 14, boxHeight: 14 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed[isHorizontal ? "x" : "y"]} ocurrencias`,
          },
        },
      },
      scales: chartType === "doughnut" ? {} : {
        x: {
          grid:  { color: "rgba(0,0,0,0.05)" },
          ticks: { font: { size: 11 }, color: "#374151" },
        },
        y: {
          grid:         { color: "rgba(0,0,0,0.05)" },
          ticks:        { font: { size: 11 }, color: "#374151" },
          beginAtZero:  true,
        },
      },
      animation: { duration: 400, easing: "easeInOutQuart" },
    },
  });

  // Dynamic canvas height
  const n = chartData.labels.length;
  const h = chartType === "doughnut" ? 340 : isHorizontal ? Math.max(260, n * 30) : 340;
  document.getElementById("mainChart").style.height = `${h}px`;

  renderExamples(filters);
}

/* ── Examples render ────────────────────────────────────────────────────────── */
function renderExamples({ platform, anglicism }) {
  const panel = document.getElementById("examplesPanel");
  if (!anglicism) { panel.style.display = "none"; return; }

  const filtered = DATA.filter(
    (r) => r.a === anglicism && (!platform || r.p === platform)
  );

  panel.style.display = "block";
  document.getElementById("examplesTag").textContent = anglicism;

  const grid = document.getElementById("examplesGrid");
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="no-examples">No hay ejemplos para esta combinación.</div>';
    return;
  }

  grid.innerHTML = filtered
    .map(
      (r) => `
      <div class="example-item">
        <div class="example-meta">
          <span class="platform-badge badge-${r.p}">${r.p}</span>
        </div>
        <div class="example-phrase">«${r.f}»</div>
      </div>`
    )
    .join("");
}

/* ── Event listeners ────────────────────────────────────────────────────────── */
document.querySelectorAll(".chart-type-group button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-type-group button").forEach((b) =>
      b.classList.remove("active")
    );
    btn.classList.add("active");
    chartType = btn.dataset.type;
    renderChart();
  });
});

document.getElementById("platformFilter").addEventListener("change", renderChart);
document.getElementById("anglicismFilter").addEventListener("change", renderChart);
document.getElementById("topN").addEventListener("change", renderChart);

/* ── Bootstrap ──────────────────────────────────────────────────────────────── */
loadData();
