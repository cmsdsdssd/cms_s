const EMPTY_VALUE = "-";

export const buildSnapshotPreFeeBreakdownRows = ({
  laborPreFee,
  materialPreFee,
  totalPreFee,
  formatCurrency,
}) => {
  const fmt = typeof formatCurrency === "function"
    ? formatCurrency
    : (value) => (typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString()}won` : EMPTY_VALUE);

  return [
    { key: "labor-pre-fee", label: "공임(수수료 반영 전)", valueText: fmt(laborPreFee) },
    { key: "material-pre-fee", label: "소재(수수료 반영 전)", valueText: fmt(materialPreFee) },
    { key: "total-pre-fee", label: "후보합(수수료 반영 전)", valueText: fmt(totalPreFee) },
  ];
};
