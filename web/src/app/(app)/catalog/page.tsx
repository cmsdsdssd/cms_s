"use client";

import { useMemo, useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Grid2x2, List } from "lucide-react";
import { cn } from "@/lib/utils";

type CatalogItem = {
  id: string;
  model: string;
  name: string;
  date: string;
  status: string;
  tone: "neutral" | "active" | "warning";
  weight: string;
  material: string;
  stone: string;
  vendor: string;
  color: string;
  cost: string;
  grades: string[];
};

const catalogItems: CatalogItem[] = [
  {
    id: "4949R",
    model: "4949R",
    name: "다이아 밴드",
    date: "2025-12-16",
    status: "판매 중",
    tone: "active",
    weight: "3.45 g",
    material: "14K 로즈골드",
    stone: "다이아 0.2ct",
    vendor: "글로벌 젬스",
    color: "로즈(P)",
    cost: "₩185,000",
    grades: ["₩450", "₩420", "₩390", "₩350"],
  },
  {
    id: "5980R",
    model: "5980R",
    name: "클래식 웨딩",
    date: "2025-12-15",
    status: "이미지 대기",
    tone: "warning",
    weight: "5.10 g",
    material: "18K 화이트골드",
    stone: "없음",
    vendor: "로컬 아티산",
    color: "화이트(W)",
    cost: "₩210,000",
    grades: ["₩550", "₩520", "₩490", "₩450"],
  },
  {
    id: "4184B",
    model: "4184B",
    name: "빈티지 펜던트",
    date: "2025-12-14",
    status: "신규",
    tone: "neutral",
    weight: "2.15 g",
    material: "14K 옐로골드",
    stone: "사파이어",
    vendor: "글로벌 젬스",
    color: "옐로(Y)",
    cost: "₩140,000",
    grades: ["₩320", "₩300", "₩280", "₩250"],
  },
  {
    id: "6220W",
    model: "6220W",
    name: "모던 링",
    date: "2025-12-12",
    status: "판매 중",
    tone: "active",
    weight: "3.80 g",
    material: "18K 화이트골드",
    stone: "다이아 0.1ct",
    vendor: "아뜰리에 K",
    color: "화이트(W)",
    cost: "₩210,000",
    grades: ["₩520", "₩500", "₩470", "₩430"],
  },
  {
    id: "7012G",
    model: "7012G",
    name: "클래식 체인",
    date: "2025-12-10",
    status: "판매 중",
    tone: "active",
    weight: "4.05 g",
    material: "14K 옐로골드",
    stone: "없음",
    vendor: "실버라인",
    color: "옐로(Y)",
    cost: "₩160,000",
    grades: ["₩330", "₩310", "₩290", "₩260"],
  },
  {
    id: "8831P",
    model: "8831P",
    name: "피어싱 라인",
    date: "2025-12-08",
    status: "이미지 대기",
    tone: "warning",
    weight: "1.40 g",
    material: "14K 로즈골드",
    stone: "없음",
    vendor: "로즈 아뜰리에",
    color: "로즈(P)",
    cost: "₩120,000",
    grades: ["₩280", "₩260", "₩240", "₩220"],
  },
  {
    id: "9902N",
    model: "9902N",
    name: "네크리스 라인",
    date: "2025-12-07",
    status: "판매 중",
    tone: "active",
    weight: "6.20 g",
    material: "18K 옐로골드",
    stone: "루비",
    vendor: "글로벌 젬스",
    color: "옐로(Y)",
    cost: "₩260,000",
    grades: ["₩650", "₩620", "₩580", "₩540"],
  },
  {
    id: "3091B",
    model: "3091B",
    name: "브레이슬릿",
    date: "2025-12-05",
    status: "신규",
    tone: "neutral",
    weight: "5.75 g",
    material: "14K 옐로골드",
    stone: "없음",
    vendor: "로컬 아티산",
    color: "옐로(Y)",
    cost: "₩190,000",
    grades: ["₩420", "₩400", "₩380", "₩360"],
  },
  {
    id: "5511W",
    model: "5511W",
    name: "베이직 링",
    date: "2025-12-03",
    status: "판매 중",
    tone: "active",
    weight: "2.95 g",
    material: "18K 화이트골드",
    stone: "없음",
    vendor: "럭스 스튜디오",
    color: "화이트(W)",
    cost: "₩150,000",
    grades: ["₩360", "₩340", "₩320", "₩300"],
  },
  {
    id: "7208G",
    model: "7208G",
    name: "팬던트 라이트",
    date: "2025-12-01",
    status: "이미지 대기",
    tone: "warning",
    weight: "2.05 g",
    material: "14K 옐로골드",
    stone: "진주",
    vendor: "글로벌 젬스",
    color: "옐로(Y)",
    cost: "₩135,000",
    grades: ["₩310", "₩295", "₩275", "₩250"],
  },
];

const pageSize = 5;

export default function CatalogPage() {
  const [view, setView] = useState<"list" | "gallery">("list");
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(catalogItems.length / pageSize);
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return catalogItems.slice(start, start + pageSize);
  }, [page]);

  return (
    <div className="space-y-6" id="catalog.root">
      <ActionBar
        title={
          <div className="flex items-center gap-3">
            <span>상품 카탈로그</span>
            <span className="rounded-full bg-[var(--chip)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
              410개
            </span>
          </div>
        }
        subtitle="마스터카드 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              새 상품 등록
            </Button>
            <div className="flex items-center rounded-[12px] border border-[var(--panel-border)] bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setPage(1);
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[10px]",
                  view === "list" ? "bg-[var(--chip)] text-[var(--foreground)]" : "text-[var(--muted)]"
                )}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("gallery");
                  setPage(1);
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[10px]",
                  view === "gallery" ? "bg-[var(--chip)] text-[var(--foreground)]" : "text-[var(--muted)]"
                )}
              >
                <Grid2x2 size={16} />
              </button>
            </div>
          </div>
        }
        id="catalog.actionBar"
      />
      <FilterBar id="catalog.filterBar">
        <Input placeholder="모델명, 태그 검색" />
        <Select>
          <option>전체 카테고리</option>
        </Select>
        <Select>
          <option>재질 전체</option>
        </Select>
        <Select>
          <option>상태: 판매중</option>
        </Select>
        <Button variant="secondary">추가 필터</Button>
      </FilterBar>
      <div id="catalog.body">
        <SplitLayout
          left={
            <div className="space-y-4" id="catalog.listPanel">
              {view === "list" ? (
                <div className="space-y-4">
                  {pageItems.map((item) => (
                    <Card key={item.id} className="p-5">
                      <div className="flex gap-6">
                        <div className="relative h-28 w-28 overflow-hidden rounded-[14px] bg-gradient-to-br from-[#e7edf5] to-[#f7faff]">
                          <div className="absolute right-2 top-2 h-6 w-6 rounded-full border border-white/80 bg-white/80" />
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted)]">
                            이미지
                          </div>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-semibold text-[var(--foreground)]">{item.model}</p>
                              <Badge tone={item.tone}>{item.status}</Badge>
                            </div>
                            <div className="text-xs text-[var(--muted)]">{item.date}</div>
                          </div>
                          <p className="text-sm text-[var(--muted)]">{item.name}</p>
                          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                            {[
                              { label: "중량", value: item.weight },
                              { label: "재질", value: item.material },
                              { label: "스톤", value: item.stone },
                              { label: "공급처", value: item.vendor },
                            ].map((meta) => (
                              <div
                                key={meta.label}
                                className="rounded-[12px] border border-[var(--panel-border)] bg-[#f7f9fc] px-3 py-2"
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                  {meta.label}
                                </p>
                                <p className="text-xs font-semibold text-[var(--foreground)]">{meta.value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-5 gap-2 text-xs">
                            <div className="text-[var(--muted)]">색상</div>
                            <div className="text-[var(--muted)]">원가</div>
                            <div className="text-[var(--muted)]">등급1</div>
                            <div className="text-[var(--muted)]">등급2</div>
                            <div className="text-[var(--muted)]">등급3</div>
                            <div className="font-semibold text-[var(--foreground)]">{item.color}</div>
                            <div className="font-semibold text-[var(--foreground)]">{item.cost}</div>
                            <div className="font-semibold text-[var(--foreground)]">{item.grades[0]}</div>
                            <div className="font-semibold text-[var(--foreground)]">{item.grades[1]}</div>
                            <div className="font-semibold text-[var(--foreground)]">{item.grades[2]}</div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {pageItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      <div className="h-40 bg-gradient-to-br from-[#e7edf5] to-[#f7faff]" />
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{item.model}</p>
                          <Badge tone={item.tone}>{item.status}</Badge>
                        </div>
                        <p className="text-xs text-[var(--muted)]">{item.name}</p>
                        <div className="text-xs text-[var(--muted)]">{item.material}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3">
                <p className="text-xs text-[var(--muted)]">
                  {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, catalogItems.length)} / {catalogItems.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    이전
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </div>
          }
          right={
            <div className="space-y-4" id="catalog.detailPanel">
              <Card id="catalog.detail.basic">
                <CardHeader>
                  <ActionBar title="기본 정보" />
                </CardHeader>
                <CardBody className="grid gap-3">
                  <Input placeholder="공급처" />
                  <Input placeholder="모델명" />
                  <Input placeholder="상품명" />
                  <Select>
                    <option>카테고리</option>
                  </Select>
                  <Select>
                    <option>기본 재질</option>
                  </Select>
                  <Input type="date" />
                </CardBody>
              </Card>
              <Card id="catalog.detail.table">
                <CardHeader>
                  <ActionBar title="공임 및 가격" actions={<Button variant="secondary">이전 항목 복사</Button>} />
                </CardHeader>
                <CardBody className="grid gap-3">
                  <div className="rounded-[12px] border border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                    가격 테이블 자리
                  </div>
                </CardBody>
              </Card>
              <Card id="catalog.detail.raw">
                <CardHeader>
                  <ActionBar title="추가 메모" />
                </CardHeader>
                <CardBody>
                  <Textarea placeholder="내부 메모" />
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>
    </div>
  );
}
