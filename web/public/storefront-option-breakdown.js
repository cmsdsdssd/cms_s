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

  const applyAxisDeltasToSelect = (selectEl, deltaByLabel) => {
    if (!selectEl || !(selectEl instanceof HTMLSelectElement)) return;
    for (const option of Array.from(selectEl.options)) {
      const raw = String(option.textContent ?? option.innerText ?? "").trim();
      const normalized = stripSuffix(raw);
      if (!normalized) continue;
      if (/^[-]+$/.test(normalized)) continue;
      if (normalized.includes("필수") || normalized.includes("선택")) continue;
      if (!deltaByLabel.has(normalized)) continue;
      option.textContent = formatWithDelta(normalized, deltaByLabel.get(normalized));
    }
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

    const firstValues = Array.isArray(payload.axis?.first?.values) ? payload.axis.first.values : [];
    const secondValues = Array.isArray(payload.axis?.second?.values) ? payload.axis.second.values : [];
    const byVariant = Array.isArray(payload.by_variant) ? payload.by_variant : [];
    const firstMap = new Map(firstValues.map((v) => [String(v.label ?? "").trim(), Number(v.delta_krw ?? 0)]));
    const secondResidualMap = new Map(secondValues.map((v) => [String(v.label ?? "").trim(), Number(v.delta_krw ?? 0)]));

    const selectEls = Array.from(document.querySelectorAll("select[id^='product_option_id']"));
    const firstSelect = selectEls[0] ?? null;
    const secondSelect = selectEls[1] ?? null;

    const getSelectedFirstLabel = () => {
      if (firstSelect instanceof HTMLSelectElement) {
        const option = firstSelect.options[firstSelect.selectedIndex] ?? null;
        const label = stripSuffix(String(option?.textContent ?? option?.innerText ?? "").trim());
        if (label && !label.includes("필수") && !label.includes("선택") && !/^[-]+$/.test(label)) return label;
      }
      const fallback = String(firstValues[0]?.label ?? byVariant[0]?.first_value ?? "").trim();
      return fallback;
    };

    const buildSecondTotalMap = (selectedFirstLabel) => {
      const map = new Map();
      const normalizedFirst = String(selectedFirstLabel ?? "").trim();
      for (const row of byVariant) {
        const firstValue = String(row?.first_value ?? "").trim();
        const secondValue = String(row?.second_value ?? "").trim();
        const totalDelta = Math.round(Number(row?.total_delta_krw ?? Number.NaN));
        if (!firstValue || !secondValue || !Number.isFinite(totalDelta)) continue;
        if (normalizedFirst && firstValue !== normalizedFirst) continue;
        if (!map.has(secondValue)) map.set(secondValue, totalDelta);
      }
      if (map.size > 0) return map;
      return new Map(secondResidualMap);
    };

    let renderTimer = null;
    const render = () => {
      applyAxisDeltasToSelect(firstSelect, firstMap);
      applyAxisDeltasToSelect(secondSelect, buildSecondTotalMap(getSelectedFirstLabel()));
    };
    const scheduleRender = () => {
      if (renderTimer) window.clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => {
        renderTimer = null;
        render();
      }, 30);
    };

    render();
    scheduleRender();
    if (firstSelect instanceof HTMLSelectElement) {
      firstSelect.addEventListener("change", scheduleRender);
      firstSelect.addEventListener("input", scheduleRender);
    }
    if (secondSelect instanceof HTMLSelectElement) {
      secondSelect.addEventListener("change", scheduleRender);
      secondSelect.addEventListener("input", scheduleRender);
    }
    const observeSelect = (selectEl) => {
      if (!(selectEl instanceof HTMLSelectElement) || typeof MutationObserver === "undefined") return;
      const observer = new MutationObserver(() => scheduleRender());
      observer.observe(selectEl, { childList: true, subtree: true, characterData: true });
    };
    observeSelect(firstSelect);
    observeSelect(secondSelect);
    if (typeof MutationObserver !== "undefined") {
      const rootObserver = new MutationObserver(() => {
        const nextSelectEls = Array.from(document.querySelectorAll("select[id^='product_option_id']"));
        const nextFirst = nextSelectEls[0] ?? null;
        const nextSecond = nextSelectEls[1] ?? null;
        if (nextFirst !== firstSelect || nextSecond !== secondSelect) {
          scheduleRender();
        }
      });
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
