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
    const firstMap = new Map(firstValues.map((v) => [String(v.label ?? "").trim(), Number(v.delta_krw ?? 0)]));
    const secondMap = new Map(secondValues.map((v) => [String(v.label ?? "").trim(), Number(v.delta_krw ?? 0)]));

    const selectEls = Array.from(document.querySelectorAll("select[id^='product_option_id']"));
    const firstSelect = selectEls[0] ?? null;
    const secondSelect = selectEls[1] ?? null;
    applyAxisDeltasToSelect(firstSelect, firstMap);
    applyAxisDeltasToSelect(secondSelect, secondMap);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      run();
    }, { once: true });
  } else {
    run();
  }
})();
