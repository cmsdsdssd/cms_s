import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import Providers from "./providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MS",
  description: "1차 운영 UI",
};

// web/src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${manrope.variable} ${jetbrainsMono.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var key='cms_theme';
              var stored=localStorage.getItem(key);
              var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
              var theme=(stored==='light'||stored==='dark')?stored:(prefersDark?'dark':'light');
              document.documentElement.dataset.theme=theme;
              document.documentElement.style.colorScheme=theme;
            }catch(e){}})();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
