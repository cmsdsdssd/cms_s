(() => {
  const stripSuffix = (text) => String(text ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();

  const detectProductNo = () => {
    const fromQuery = new URL(window.location.href).searchParams.get("product_no");
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();
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

  const buildDisplayLabelMap = (axis) => new Map(
    (Array.isArray(axis?.values) ? axis.values : []).map((value) => {
      const canonical = stripSuffix(String(value?.label ?? "").trim());
      const display = String(value?.display_label ?? value?.label ?? "").trim();
      return [canonical, display || canonical];
    }).filter(([label]) => label),
  );

  const applyAxisDisplayLabelsToSelect = (selectEl, displayLabelByLabel) => {
    if (!selectEl || !(selectEl instanceof HTMLSelectElement)) return;
    for (const option of Array.from(selectEl.options)) {
      const raw = String(option.textContent ?? option.innerText ?? "").trim();
      const normalized = stripSuffix(raw);
      if (!normalized) continue;
      if (/^[-]+$/.test(normalized)) continue;
      if (normalized.includes("필수") || normalized.includes("선택")) continue;
      option.textContent = displayLabelByLabel?.get(normalized) ?? normalized;
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
      option.textContent = String(value?.display_label ?? value?.label ?? "").trim();
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
    const currentScript = document.currentScript instanceof HTMLScriptElement ? document.currentScript : null;
    const scriptUrl = currentScript?.src ? new URL(currentScript.src) : null;
    const scriptOrigin = scriptUrl?.origin ?? "";
    const apiBase = String(cfg.apiBase ?? scriptOrigin).trim();
    if (!apiBase) return;

    const mallId = String(cfg.mallId ?? scriptUrl?.searchParams.get("mall_id") ?? detectMallId()).trim().toLowerCase();
    const productNo = String(cfg.productNo ?? scriptUrl?.searchParams.get("product_no") ?? detectProductNo()).trim();
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
    let renderTimer = null;
    const bindAndRender = () => {
      const { realSelects, syntheticSelects } = ensureSyntheticSelects(axisDefs);
      const controls = axisDefs.map((_, index) => realSelects[index] ?? syntheticSelects[index - realSelects.length] ?? null);

      for (let i = 0; i < axisDefs.length; i += 1) {
        const axis = axisDefs[i];
        const displayLabelMap = buildDisplayLabelMap(axis);
        applyAxisDisplayLabelsToSelect(controls[i], displayLabelMap);
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
