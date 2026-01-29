export function deriveCategoryCodeFromModelName(modelName: string): string | null {
    const raw = String(modelName ?? "").trim();
    if (!raw) return null;

    // 1) 마지막 '-' 세그먼트 우선
    const parts = raw.split("-").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
        const lastSeg = parts[parts.length - 1];

        if (lastSeg === "발찌") return "ANKLET";

        if (/^[A-Za-z]$/.test(lastSeg)) return mapCatLetter(lastSeg);

        return "ETC";
    }

    // 2) 레거시 끝문자 (BK-1234B)
    const m = raw.match(/([A-Za-z])\s*$/);
    if (m?.[1]) return mapCatLetter(m[1]);

    if (raw.endsWith("발찌")) return "ANKLET";
    return null;
}

function mapCatLetter(letter: string): string {
    switch (letter.toUpperCase()) {
        case "R": return "RING";
        case "B": return "BRACELET";
        case "E": return "EARRING";
        case "N": return "NECKLACE";
        case "M": return "PENDANT";
        case "U": return "ACCESSORY"; // ✅ 부속
        case "W": return "WATCH";
        case "K": return "KEYRING";
        case "S": return "SYMBOL";
        case "Z": default: return "ETC";
    }
}
