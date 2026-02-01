import { Metadata } from "next";

export const metadata: Metadata = {
  title: "상품 카탈로그 v2 | CMS",
  description: "최신 UI/UX가 적용된 제품 카탈로그",
};

export default function Catalog2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
