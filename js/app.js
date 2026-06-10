/* ── Constants ──────────────────────────────────────────────────────────────── */
const PLATFORMS = ["TikTok", "Instagram", "WhatsApp"];

const PLATFORM_COLORS = {
  TikTok:    { solid: "#fe2c55", light: "rgba(254,44,85,0.8)" },
  Instagram: { solid: "#c13584", light: "rgba(193,53,132,0.8)" },
  WhatsApp:  { solid: "#25d366", light: "rgba(37,211,102,0.8)" },
};

const DEFAULT_COLOR = { solid: "#6366f1", light: "rgba(99,102,241,0.8)" };

const PALETTE = [
  "#6366f1","#a855f7","#ec4899","#f59e0b","#10b981",
  "#3b82f6","#ef4444","#14b8a6","#f97316","#8b5cf6",
  "#06b6d4","#84cc16","#e11d48","#0ea5e9","#d946ef",
];

/* ── State ──────────────────────────────────────────────────────────────────── */
let DATA             = [];
let chartType        = "bar";
let chartInstance    = null;
const groupedMode    = true;
let selectedVariants = new Set();

/* ── Data loading ───────────────────────────────────────────────────────────── */
async function loadData() {
  document.querySelector(".chart-wrapper").innerHTML =
    '<div class="loading-state">Cargando datos…</div>';
  try {
    const res = await fetch("/data/anglicismos.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    DATA = raw.map((r) => ({
      p:         r.p,
      a:         r.a.toLowerCase().trim(),
      canonical: (r.canonical || r.a).toLowerCase().trim(),
      f:         r.f,
    }));
    initUI();
    renderAll();
  } catch (err) {
    document.querySelector(".chart-wrapper").innerHTML =
      `<div class="error-state">Error al cargar los datos: ${err.message}</div>`;
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function getKey(r)             { return groupedMode ? r.canonical : r.a; }
function filterByPlatform(p)   { return p ? DATA.filter((r) => r.p === p) : DATA; }

function getVariantsOf(canonical) {
  return [...new Set(DATA.filter((r) => r.canonical === canonical).map((r) => r.a))].sort();
}

/* ── UI init ────────────────────────────────────────────────────────────────── */
function initUI() {
  // Pills dinámicos
  const total   = DATA.length;
  const unique  = new Set(DATA.map((r) => r.canonical)).size;
  document.querySelector("#pillTotal span").textContent  = total;
  document.querySelector("#pillUnique span").textContent = unique;

  populateAnglicismSelect();
}

function populateAnglicismSelect() {
  const platform = document.getElementById("platformFilter").value;
  const rows     = filterByPlatform(platform);
  const counts   = {};
  rows.forEach((r) => {
    const k = getKey(r);
    counts[k] = (counts[k] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const select = document.getElementById("anglicismFilter");
  const prev   = select.value;
  select.innerHTML = '<option value="">Ver ranking general</option>';
  sorted.forEach(([key, count]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${key} (${count})`;
    select.appendChild(opt);
  });
  if ([...select.options].some((o) => o.value === prev)) select.value = prev;
}

/* ── Variants panel ─────────────────────────────────────────────────────────── */
function renderVariantsPanel() {
  const panel    = document.getElementById("variantsPanel");
  const anglicism = document.getElementById("anglicismFilter").value;

  if (!anglicism || !groupedMode) { panel.style.display = "none"; return; }

  const variants = getVariantsOf(anglicism);

  // Si solo hay una variante (la canónica misma), no mostrar panel
  if (variants.length <= 1) { panel.style.display = "none"; return; }

  // Inicializar selección si es nueva
  if (selectedVariants.size === 0 || !variants.some((v) => selectedVariants.has(v))) {
    selectedVariants = new Set(variants);
  }

  panel.style.display = "block";

  const platform = document.getElementById("platformFilter").value;
  const rows     = filterByPlatform(platform).filter((r) => r.canonical === anglicism);
  const countMap = {};
  rows.forEach((r) => { countMap[r.a] = (countMap[r.a] || 0) + 1; });

  panel.innerHTML = `
    <div class="variants-header">
      <span class="variants-title">Variantes de <strong>${anglicism}</strong></span>
      <div class="variants-actions">
        <button class="variants-btn" id="selectAll">Todas</button>
        <button class="variants-btn" id="selectNone">Ninguna</button>
      </div>
    </div>
    <div class="variants-chips">
      ${variants.map((v) => {
        const cnt     = countMap[v] || 0;
        const checked = selectedVariants.has(v);
        return `
          <label class="variant-chip ${checked ? "checked" : ""}" data-variant="${v}">
            <input type="checkbox" value="${v}" ${checked ? "checked" : ""} />
            <span class="chip-label">${v}</span>
            <span class="chip-count">${cnt}</span>
          </label>`;
      }).join("")}
    </div>`;

  // Eventos
  panel.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) selectedVariants.add(cb.value);
      else            selectedVariants.delete(cb.value);
      cb.closest("label").classList.toggle("checked", cb.checked);
      renderAll();
    });
  });

  document.getElementById("selectAll").addEventListener("click", () => {
    selectedVariants = new Set(variants);
    renderAll();
  });
  document.getElementById("selectNone").addEventListener("click", () => {
    selectedVariants.clear();
    renderAll();
  });
}

/* ── Chart data ─────────────────────────────────────────────────────────────── */
function computeChartData({ platform, anglicism, topN }) {

  // ── Con anglicismo seleccionado → gráfico de variantes activas ──
  if (anglicism) {
    if (platform) return null;

    const variants  = groupedMode ? getVariantsOf(anglicism) : [anglicism];
    const active    = groupedMode
      ? variants.filter((v) => selectedVariants.has(v))
      : variants;

    if (active.length === 0) return { empty: true };

    // Modo agrupado: un bar/slice por variante
    if (groupedMode && active.length > 1) {
      const rows  = DATA.filter((r) => r.canonical === anglicism && active.includes(r.a));
      const counts = {};
      active.forEach((v) => { counts[v] = 0; });
      rows.forEach((r) => { counts[r.a]++; });

      const total  = Object.values(counts).reduce((s, v) => s + v, 0);
      const labels = active;
      const values = active.map((v) => counts[v]);

      return {
        labels,
        values,
        total,
        datasets: [{
          label: anglicism,
          data:  values,
          backgroundColor: chartType === "doughnut"
            ? PALETTE.slice(0, labels.length)
            : labels.map((_, i) => PALETTE[i % PALETTE.length] + "d9"),
          borderColor: PALETTE.slice(0, labels.length),
          borderWidth: 2,
          borderRadius: chartType !== "doughnut" ? 8 : 0,
          pointRadius: 5, fill: false, tension: 0.4,
        }],
        title:    `Variantes de «${anglicism}»`,
        subtitle: `${active.length} variante${active.length > 1 ? "s" : ""} seleccionada${active.length > 1 ? "s" : ""} · ${total} ocurrencias en total`,
      };
    }

    // Variante única o modo exacto → distribución por plataforma
    const key      = active[0] || anglicism;
    const filtered = DATA.filter((r) =>
      groupedMode ? (r.canonical === anglicism && active.includes(r.a)) : r.a === key
    );
    const counts   = {};
    PLATFORMS.forEach((p) => { counts[p] = 0; });
    filtered.forEach((r) => { counts[r.p]++; });
    const total = filtered.length;

    return {
      labels: PLATFORMS,
      values: PLATFORMS.map((p) => counts[p]),
      total,
      datasets: [{
        label: anglicism,
        data:  PLATFORMS.map((p) => counts[p]),
        backgroundColor: PLATFORMS.map((p) => PLATFORM_COLORS[p].light),
        borderColor:     PLATFORMS.map((p) => PLATFORM_COLORS[p].solid),
        borderWidth: 2, borderRadius: 8,
        pointBackgroundColor: PLATFORMS.map((p) => PLATFORM_COLORS[p].solid),
        pointRadius: 6, fill: false, tension: 0.4,
      }],
      title:    `«${anglicism}» por red social`,
      subtitle: `${total} ocurrencias en total`,
    };
  }

  // ── Ranking general ──
  const rows   = filterByPlatform(platform);
  const counts = {};
  rows.forEach((r) => {
    const k = getKey(r);
    counts[k] = (counts[k] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN);
  const labels = sorted.map((e) => e[0]);
  const values = sorted.map((e) => e[1]);
  const total  = values.reduce((s, v) => s + v, 0);

  return {
    labels, values, total,
    datasets: [{
      label: "Ocurrencias",
      data:  values,
      backgroundColor: chartType === "doughnut"
        ? PALETTE.slice(0, labels.length)
        : labels.map((_, i) => PALETTE[i % PALETTE.length] + "d9"),
      borderColor: PALETTE.slice(0, labels.length),
      borderWidth: 2,
      borderRadius: chartType !== "doughnut" ? 8 : 0,
      pointBackgroundColor: (platform ? PLATFORM_COLORS[platform] : DEFAULT_COLOR).solid,
      pointRadius: 5, fill: false, tension: 0.4,
    }],
    title: platform
      ? `Top ${topN} anglicismos en ${platform}`
      : `Top ${topN} anglicismos más usados`,
    subtitle: platform
      ? `De un total de ${rows.length} ocurrencias en ${platform}`
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
      '<div class="empty-state">Selecciona solo la red social <em>o</em> el anglicismo.</div>';
    return;
  }

  if (chartData.empty) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    document.querySelector(".chart-wrapper").innerHTML =
      '<div class="empty-state">Selecciona al menos una variante para ver la gráfica.</div>';
    document.getElementById("chartTitle").textContent    = "";
    document.getElementById("chartSubtitle").textContent = "";
    return;
  }

  document.getElementById("chartTitle").textContent    = chartData.title;
  document.getElementById("chartSubtitle").textContent = chartData.subtitle;

  const wrapper = document.querySelector(".chart-wrapper");
  if (!wrapper.querySelector("canvas")) wrapper.innerHTML = '<canvas id="mainChart"></canvas>';

  const ctx = document.getElementById("mainChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  const isHorizontal = chartType === "bar" && chartData.labels.length > 8;
  const actualType   = chartType === "doughnut" ? "doughnut" : (isHorizontal ? "bar" : chartType);
  const total        = chartData.total || 1;

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
            label: (ctx) => {
              const val = ctx.parsed[isHorizontal ? "x" : (chartType === "doughnut" ? undefined : "y")]
                ?? ctx.parsed;
              const n   = typeof val === "number" ? val : ctx.raw;
              const pct = ((n / total) * 100).toFixed(1);
              return chartType === "doughnut"
                ? ` ${n} ocurrencias — ${pct}%`
                : ` ${n} ocurrencias (${pct}%)`;
            },
          },
        },
        // Etiquetas de % dentro del doughnut
        ...(chartType === "doughnut" ? {
          datalabels: undefined,  // no usamos plugin extra; el tooltip ya lo cubre
        } : {}),
      },
      scales: chartType === "doughnut" ? {} : {
        x: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11 }, color: "#374151" } },
        y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11 }, color: "#374151" }, beginAtZero: true },
      },
      animation: { duration: 400, easing: "easeInOutQuart" },
    },
  });

  const n = chartData.labels.length;
  const h = chartType === "doughnut" ? 340 : isHorizontal ? Math.max(260, n * 30) : 340;
  document.getElementById("mainChart").style.height = `${h}px`;
}

/* ── Examples render ────────────────────────────────────────────────────────── */
function renderExamples() {
  const panel     = document.getElementById("examplesPanel");
  const { platform, anglicism } = getFilters();
  if (!anglicism) { panel.style.display = "none"; return; }

  const active = groupedMode ? selectedVariants : new Set([anglicism]);
  const filtered = DATA.filter(
    (r) => (groupedMode ? r.canonical === anglicism && active.has(r.a) : r.a === anglicism)
      && (!platform || r.p === platform)
  );

  panel.style.display = "block";
  document.getElementById("examplesTag").textContent = anglicism;

  const grid = document.getElementById("examplesGrid");
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="no-examples">No hay ejemplos para esta combinación.</div>';
    return;
  }

  if (groupedMode) {
    const byVariant = {};
    filtered.forEach((r) => { (byVariant[r.a] = byVariant[r.a] || []).push(r); });
    const variants = Object.keys(byVariant).sort();
    const hasMultiple = variants.length > 1;

    grid.innerHTML = variants.map((v) => {
      const rows = byVariant[v];
      return `
        <div class="variant-group ${hasMultiple ? "has-variants" : ""}">
          ${hasMultiple ? `<span class="variant-tag">${v}</span>` : ""}
          <div class="variant-examples">
            ${rows.map((r) => `
              <div class="example-item">
                <div class="example-meta">
                  <span class="platform-badge badge-${r.p}">${r.p}</span>
                </div>
                <div class="example-phrase">«${r.f}»</div>
              </div>`).join("")}
          </div>
        </div>`;
    }).join("");
  } else {
    grid.innerHTML = filtered.map((r) => `
      <div class="example-item">
        <div class="example-meta"><span class="platform-badge badge-${r.p}">${r.p}</span></div>
        <div class="example-phrase">«${r.f}»</div>
      </div>`).join("");
  }
}

/* ── Full render cycle ──────────────────────────────────────────────────────── */
function renderAll() {
  renderVariantsPanel();
  renderChart();
  renderExamples();
}

/* ── Filters helper ─────────────────────────────────────────────────────────── */
function getFilters() {
  return {
    platform:  document.getElementById("platformFilter").value,
    anglicism: document.getElementById("anglicismFilter").value,
    topN:      parseInt(document.getElementById("topN").value, 10),
  };
}

/* ── Event listeners ────────────────────────────────────────────────────────── */
document.querySelectorAll(".chart-type-group button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-type-group button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    chartType = btn.dataset.type;
    renderChart();
  });
});

document.getElementById("platformFilter").addEventListener("change", () => {
  selectedVariants.clear();
  populateAnglicismSelect();
  renderAll();
});
document.getElementById("anglicismFilter").addEventListener("change", () => {
  selectedVariants.clear();
  renderAll();
});
document.getElementById("topN").addEventListener("change", renderAll);

/* ── Bootstrap ──────────────────────────────────────────────────────────────── */
loadData();
