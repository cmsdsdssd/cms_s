export const CMS_LAST_PATH_APP_KEY = "cms_last_path_app";
export const CMS_LAST_PATH_ANALYSIS_KEY = "cms_last_path_analysis";

export const APP_DEFAULT_PATH = "/dashboard";
export const ANALYSIS_DEFAULT_PATH = "/analysis/overview";

const isClient = () => typeof window !== "undefined";

export const isAnalysisPathname = (pathname: string) =>
  pathname === "/analysis" || pathname.startsWith("/analysis/");

export const saveLastPathByMode = (pathname: string) => {
  if (!isClient()) return;
  if (!pathname || pathname.startsWith("/api") || pathname.startsWith("/_next")) return;

  const key = isAnalysisPathname(pathname) ? CMS_LAST_PATH_ANALYSIS_KEY : CMS_LAST_PATH_APP_KEY;
  window.localStorage.setItem(key, pathname);
};

export const getLastPathByMode = (mode: "app" | "analysis") => {
  if (!isClient()) {
    return mode === "analysis" ? ANALYSIS_DEFAULT_PATH : APP_DEFAULT_PATH;
  }

  const key = mode === "analysis" ? CMS_LAST_PATH_ANALYSIS_KEY : CMS_LAST_PATH_APP_KEY;
  const fallback = mode === "analysis" ? ANALYSIS_DEFAULT_PATH : APP_DEFAULT_PATH;
  return window.localStorage.getItem(key) || fallback;
};

export const getToggleTargetPath = (pathname: string) => {
  const inAnalysis = isAnalysisPathname(pathname);
  return inAnalysis ? getLastPathByMode("app") : getLastPathByMode("analysis");
};
