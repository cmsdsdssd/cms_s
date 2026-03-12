(() => {
  const stripSuffix = (text) => String(text ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();

  const formatWithDelta = (base, delta) => {
    const clean = stripSuffix(base);
    const rounded = Math.round(Number(delta ?? 0));
    if (!Number.isFinite(rounded) || rounded === 0) return clean;
    const sign = rounded >= 0 ? "+" : "-";
    return `${clean} (${sign}${Math.abs(rounded).toLocaleString("ko-KR")}원)`;
  };

  const detectProductNo = () => {
    const m = window.location.pathname.match(/\/product\/[^/]+\/([^/]+)\//i);
    return m?.[1] ? decodeURIComponent(m[1]) : "";
  };

  const detectMallId = () => {
    const host = String(window.location.hostname ?? "").toLowerCase();
    const first = host.split(".")[0] ?? "";
    return first.trim();
  };

  const getAxisDefinitions = (payload) => {
    if (Array.isArray(payload?.axis?.axes) && payload.axis.axes.length > 0) return payload.axis.axes;
    const axes = [];
    if (payload?.axis?.first?.name) axes.push({ index: 1, name: payload.axis.first.name, values: payload.axis.first.values ?? [] });
    if (payload?.axis?.second?.name) axes.push({ index: 2, name: payload.axis.second.name, values: payload.axis.second.values ?? [] });
    return axes;
  };

  const getVariantAxisValues = (row, axisDefs) => {
    if (Array.isArray(row?.axis_values) && row.axis_values.length > 0) {
      return row.axis_values.map((axisValue, index) => ({
        index: Number(axisValue?.index ?? index + 1),
        name: String(axisValue?.name ?? axisDefs[index]?.name ?? "").trim(),
        value: stripSuffix(String(axisValue?.value ?? "").trim()),
      })).filter((axisValue) => axisValue.name && axisValue.value);
    }
    return [row?.first_value, row?.second_value, row?.third_value]
      .map((value, index) => ({
        index: index + 1,
        name: String(axisDefs[index]?.name ?? "").trim(),
        value: stripSuffix(String(value ?? "").trim()),
      }))
      .filter((axisValue) => axisValue.name && axisValue.value);
  };

  const buildDirectDeltaMap = (axis) => new Map(
    (Array.isArray(axis?.values) ? axis.values : []).map((value) => [
      stripSuffix(String(value?.label ?? "").trim()),
      Math.round(Number(value?.delta_krw ?? 0)),
    ]).filter(([label]) => label),
  );

  const buildConditionalDeltaMap = (axisDefs, axisIndex, selectedPriorLabels, byVariant) => {
    const totalsByLabel = new Map();
    for (const row of Array.isArray(byVariant) ? byVariant : []) {
      const axisValues = getVariantAxisValues(row, axisDefs);
      const current = axisValues[axisIndex] ?? null;
      if (!current?.value) continue;
      let matched = true;
      for (let i = 0; i < axisIndex; i += 1) {
        const expected = String(selectedPriorLabels[i] ?? "").trim();
        if (!expected) continue;
        if (String(axisValues[i]?.value ?? "").trim() !== expected) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
      const label = String(current.value ?? "").trim();
      const total = Math.round(Number(row?.total_delta_krw ?? Number.NaN));
      if (!label || !Number.isFinite(total)) continue;
      const bucket = totalsByLabel.get(label) ?? new Set();
      bucket.add(total);
      totalsByLabel.set(label, bucket);
    }
    const map = new Map();
    for (const [label, totals] of totalsByLabel.entries()) {
      if (totals.size === 1) {
        map.set(label, Array.from(totals)[0] ?? 0);
      }
    }
    return map;
  };

  const applyAxisDeltasToSelect = (selectEl, deltaByLabel) => {
    if (!selectEl || !(selectEl instanceof HTMLSelectElement)) return;
    for (const option of Array.from(selectEl.options)) {
      const raw = String(option.textContent ?? option.innerText ?? "").trim();
      const normalized = stripSuffix(raw);
      if (!normalized) continue;
      if (/^[-]+$/.test(normalized)) continue;
      if (normalized.includes("필수") || normalized.includes("선택")) continue;
      option.textContent = deltaByLabel.has(normalized)
        ? formatWithDelta(normalized, deltaByLabel.get(normalized))
        : normalized;
    }
  };

  const getSelectedLabel = (selectEl) => {
    if (!(selectEl instanceof HTMLSelectElement)) return "";
    const option = selectEl.options[selectEl.selectedIndex] ?? null;
    const label = stripSuffix(String(option?.textContent ?? option?.innerText ?? "").trim());
    if (!label || label.includes("필수") || label.includes("선택") || /^[-]+$/.test(label)) return "";
    return label;
  };

  const createSyntheticSelect = (axis) => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-cms-generated-option-preview", "true");
    wrapper.style.marginTop = "8px";

    const label = document.createElement("label");
    label.textContent = String(axis?.name ?? "옵션");
    label.style.display = "block";
    label.style.fontSize = "12px";
    label.style.marginBottom = "4px";

    const select = document.createElement("select");
    select.setAttribute("data-cms-generated-option-preview-select", "true");
    select.style.width = "100%";
    select.style.minHeight = "32px";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = `${String(axis?.name ?? "옵션")} 선택`;
    select.appendChild(placeholder);

    for (const value of Array.isArray(axis?.values) ? axis.values : []) {
      const option = document.createElement("option");
      option.value = String(value?.label ?? "").trim();
      option.textContent = String(value?.label ?? "").trim();
      select.appendChild(option);
    }

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    return { wrapper, select };
  };

  const ensureSyntheticSelects = (axisDefs) => {
    const realSelects = Array.from(document.querySelectorAll("select[id^='product_option_id']"));
    const existingWrappers = Array.from(document.querySelectorAll("[data-cms-generated-option-preview='true']"));
    existingWrappers.forEach((wrapper) => wrapper.remove());

    const syntheticSelects = [];
    if (realSelects.length >= axisDefs.length) return { realSelects, syntheticSelects };

    const anchor = realSelects[realSelects.length - 1]?.parentElement ?? document.body;
    for (let i = realSelects.length; i < axisDefs.length; i += 1) {
      const created = createSyntheticSelect(axisDefs[i]);
      syntheticSelects.push(created.select);
      anchor.appendChild(created.wrapper);
    }
    return { realSelects, syntheticSelects };
  };

  const run = async () => {
    const cfg = window.CMS_OPTION_BREAKDOWN_CONFIG ?? {};
    const apiBase = String(cfg.apiBase ?? "").trim();
    if (!apiBase) return;

    const mallId = String(cfg.mallId ?? detectMallId()).trim().toLowerCase();
    const productNo = String(cfg.productNo ?? detectProductNo()).trim();
    const token = String(cfg.token ?? "").trim();
    if (!mallId || !productNo) return;

    const qs = new URLSearchParams({ mall_id: mallId, product_no: productNo });
    if (token) qs.set("token", token);
    const url = `${apiBase.replace(/\/$/, "")}/api/public/storefront-option-breakdown?${qs.toString()}`;

    let payload;
    try {
      const res = await fetch(url, { method: "GET", credentials: "omit", mode: "cors" });
      if (!res.ok) return;
      payload = await res.json();
    } catch {
      return;
    }
    if (!payload?.ok) return;

    const axisDefs = getAxisDefinitions(payload);
    if (axisDefs.length === 0) return;
    const byVariant = Array.isArray(payload.by_variant) ? payload.by_variant : [];

    let renderTimer = null;
    const bindAndRender = () => {
      const { realSelects, syntheticSelects } = ensureSyntheticSelects(axisDefs);
      const controls = axisDefs.map((_, index) => realSelects[index] ?? syntheticSelects[index - realSelects.length] ?? null);
      const selectedPriorLabels = [];

      for (let i = 0; i < axisDefs.length; i += 1) {
        const axis = axisDefs[i];
        const directMap = buildDirectDeltaMap(axis);
        const conditionalMap = i === 0
          ? directMap
          : buildConditionalDeltaMap(axisDefs, i, selectedPriorLabels, byVariant);
        const effectiveMap = conditionalMap.size > 0 ? conditionalMap : directMap;
        applyAxisDeltasToSelect(controls[i], effectiveMap);
        selectedPriorLabels[i] = getSelectedLabel(controls[i]);
      }

      controls.forEach((control) => {
        if (!(control instanceof HTMLSelectElement) || control.dataset.cmsBreakdownBound === "true") return;
        control.dataset.cmsBreakdownBound = "true";
        control.addEventListener("change", scheduleRender);
        control.addEventListener("input", scheduleRender);
        if (typeof MutationObserver !== "undefined") {
          const observer = new MutationObserver(() => scheduleRender());
          observer.observe(control, { childList: true, subtree: true, characterData: true });
        }
      });
    };

    const scheduleRender = () => {
      if (renderTimer) window.clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => {
        renderTimer = null;
        bindAndRender();
      }, 30);
    };

    bindAndRender();
    scheduleRender();

    if (typeof MutationObserver !== "undefined") {
      const rootObserver = new MutationObserver(() => scheduleRender());
      rootObserver.observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      run();
    }, { once: true });
  } else {
    run();
  }
})();
