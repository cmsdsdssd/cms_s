"use client";

import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";

const catalogItems = [
  {
    title: "4949R",
    subtitle: "Diamond Band · 14K",
    meta: "Active · 2025-12-16",
    badge: { label: "Active", tone: "active" as const },
  },
  {
    title: "5980R",
    subtitle: "Classic Wedding · 18K",
    meta: "Pending Image · 2025-12-15",
    badge: { label: "Pending", tone: "warning" as const },
  },
  {
    title: "4184B",
    subtitle: "Vintage Pendant · 14K",
    meta: "New · 2025-12-14",
    badge: { label: "New", tone: "neutral" as const },
  },
];

export default function CatalogPage() {
  return (
    <div className="space-y-6" id="catalog.root">
      <ActionBar
        title="Catalog"
        subtitle="마스터카드"
        actions={<Button>+ Add New Product</Button>}
        id="catalog.actionBar"
      />
      <FilterBar id="catalog.filterBar">
        <Input placeholder="Search by model" />
        <Select>
          <option>All Categories</option>
        </Select>
        <Select>
          <option>Material</option>
        </Select>
        <Button variant="secondary">More Filters</Button>
      </FilterBar>
      <div id="catalog.body">
        <SplitLayout
          left={
            <div className="space-y-3" id="catalog.listPanel">
              {catalogItems.map((item) => (
                <ListCard key={item.title} {...item} />
              ))}
            </div>
          }
          right={
            <div className="space-y-4" id="catalog.detailPanel">
              <Card id="catalog.detail.basic">
                <CardHeader>
                  <ActionBar title="Basic Information" />
                </CardHeader>
                <CardBody className="grid gap-3">
                  <Input placeholder="vendor" />
                  <Input placeholder="model_name" />
                  <Input placeholder="product_name" />
                  <Select>
                    <option>category</option>
                  </Select>
                  <Select>
                    <option>standard_material</option>
                  </Select>
                  <Input type="date" />
                </CardBody>
              </Card>
              <Card id="catalog.detail.table">
                <CardHeader>
                  <ActionBar title="Labor & Pricing" actions={<Button variant="secondary">Copy from Previous</Button>} />
                </CardHeader>
                <CardBody className="grid gap-3">
                  <div className="rounded-[12px] border border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                    Pricing table placeholder
                  </div>
                </CardBody>
              </Card>
              <Card id="catalog.detail.raw">
                <CardHeader>
                  <ActionBar title="Additional Remarks" />
                </CardHeader>
                <CardBody>
                  <Textarea placeholder="internal notes" />
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>
    </div>
  );
}
