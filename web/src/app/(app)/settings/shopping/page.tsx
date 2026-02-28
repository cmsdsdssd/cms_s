"use client";

import Link from "next/link";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/settings/shopping/channels", title: "채널 설정", desc: "카페24 채널/계정 연결" },
  { href: "/settings/shopping/mappings", title: "상품 매핑", desc: "마스터ID(master_item_id)와 상품번호(product_no) 연결 관리" },
  { href: "/settings/shopping/dashboard", title: "가격 대시보드", desc: "권장가/현재가 비교 및 재계산/반영" },
  { href: "/settings/shopping/rules", title: "옵션 룰 설정", desc: "R1~R4 Sync 룰 및 라운딩 단위 관리" },
  { href: "/settings/shopping/sync-jobs", title: "동기화 로그", desc: "반영(push) 작업 성공/실패 추적" },
  { href: "/settings/shopping/factors", title: "정책/팩터", desc: "마진/반올림/팩터 세트(factor set) 관리" },
];

export default function ShoppingSettingsHomePage() {
  return (
    <div className="space-y-4">
      <ActionBar
        title="쇼핑몰 관리"
        subtitle="카페24 가격연동 운영 메뉴"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => (
          <Card key={item.href}>
            <CardHeader title={item.title} description={item.desc} />
            <CardBody>
              <Link href={item.href}>
                <Button variant="secondary">열기</Button>
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
