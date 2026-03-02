export const CMS_LAST_PATH_APP_KEY = "cms_last_path_app";
export const CMS_LAST_PATH_ANALYSIS_KEY = "cms_last_path_analysis";

export const APP_DEFAULT_PATH = "/dashboard";
export const SHOPPING_DEFAULT_PATH = "/settings/shopping";
export const ANALYSIS_DEFAULT_PATH = "/analysis/overview";

const isClient = () => typeof window !== "undefined";

export const isAnalysisPathname = (pathname: string) =>
  pathname === "/analysis" || pathname.startsWith("/analysis/");

export const isShoppingPathname = (pathname: string) =>
  pathname === SHOPPING_DEFAULT_PATH || pathname.startsWith(`${SHOPPING_DEFAULT_PATH}/`);

export type WorkspaceSection = "home" | "shopping" | "analysis";

const WORKSPACE_CYCLE: WorkspaceSection[] = ["home", "shopping", "analysis"];

const getDefaultPathBySection = (section: WorkspaceSection) => {
  if (section === "shopping") return SHOPPING_DEFAULT_PATH;
  if (section === "analysis") return ANALYSIS_DEFAULT_PATH;
  return APP_DEFAULT_PATH;
};

export const getWorkspaceSection = (pathname: string): WorkspaceSection => {
  if (isAnalysisPathname(pathname)) return "analysis";
  if (isShoppingPathname(pathname)) return "shopping";
  return "home";
};

export const getWorkspaceModeLabel = (pathname: string) => {
  const section = getWorkspaceSection(pathname);
  if (section === "shopping") return "쇼핑몰";
  if (section === "analysis") return "분석";
  return "홈";
};

export const getNextWorkspaceSection = (pathname: string): WorkspaceSection => {
  const current = getWorkspaceSection(pathname);
  const currentIndex = WORKSPACE_CYCLE.indexOf(current);
  const nextIndex = (currentIndex + 1) % WORKSPACE_CYCLE.length;
  return WORKSPACE_CYCLE[nextIndex];
};

export const getCycleToggleMeta = (pathname: string) => {
  const nextSection = getNextWorkspaceSection(pathname);
  const label = nextSection === "home" ? "홈" : nextSection === "shopping" ? "쇼핑몰" : "분석";
  return {
    nextSection,
    label,
    targetPath: getDefaultPathBySection(nextSection),
  };
};

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
  return getCycleToggleMeta(pathname).targetPath;
};
