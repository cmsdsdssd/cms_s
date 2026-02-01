import { Metadata } from "next";

export const metadata: Metadata = {
  title: "제품 카탈로그 | CMS",
  description: "제품 목록 및 관리",
};

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
