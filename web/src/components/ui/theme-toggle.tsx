"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";
const KEY = "cms_theme";

function getCurrentTheme(): Theme {
    const t = document.documentElement.dataset.theme;
    return t === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(KEY, theme); } catch { }
}

export function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setTheme(getCurrentTheme());
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Toggle theme" />
        );
    }

    const next: Theme = theme === "dark" ? "light" : "dark";

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
                applyTheme(next);
                setTheme(next);
            }}
            title={theme === "dark" ? "라이트 모드" : "다크 모드"}
            aria-label="Toggle theme"
        >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
    );
}
