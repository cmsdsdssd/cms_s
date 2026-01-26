"use client";

import { useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";

const parties = [
  {
    title: "소매A",
    subtitle: "balance ₩4,100,000",
    meta: "last activity: 2026-01-26",
    badge: { label: "DUE", tone: "warning" as const },
  },
  {
    title: "소매B",
    subtitle: "balance -₩500,000",
    meta: "last activity: 2026-01-25",
    badge: { label: "CREDIT", tone: "active" as const },
  },
];

const partyOptions = [
  { label: "소매A", value: "11111111-1111-1111-1111-111111111111" },
  { label: "소매B", value: "11111111-1111-1111-1111-222222222222" },
];

const shipmentLineOptions = [
  { label: "S-240126-04 / L-001", value: "line-001" },
  { label: "S-240125-03 / L-002", value: "line-002" },
];

export default function ArPage() {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  return (
    <div className="space-y-6" id="ar.root">
      <ActionBar
        title="AR"
        subtitle="미수/결제/반품"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setPaymentOpen(true)}>
              + Record Payment
            </Button>
            <Button onClick={() => setReturnOpen(true)}>+ Record Return</Button>
          </div>
        }
        id="ar.actionBar"
      />
      <FilterBar id="ar.filterBar">
        <Input placeholder="Search party" />
        <Select>
          <option>Balance range</option>
        </Select>
        <Input type="date" />
      </FilterBar>
      <div id="ar.body">
        <SplitLayout
          left={
            <div className="space-y-3" id="ar.listPanel">
              {parties.map((party) => (
                <ListCard key={party.title} {...party} />
              ))}
            </div>
          }
          right={
            <div id="ar.detailPanel">
              <Card id="ar.detail.ledgerTable">
                <CardHeader>
                  <ActionBar title="Ledger" />
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                      <span>Date</span>
                      <span>Type</span>
                      <span>Amount</span>
                      <span>Memo</span>
                    </div>
                    <div className="grid grid-cols-4 text-sm text-[var(--foreground)]">
                      <span>2026-01-26</span>
                      <span>SHIPMENT</span>
                      <span>+₩1,200,000</span>
                      <span>Shipment S-240126-04</span>
                    </div>
                    <div className="grid grid-cols-4 text-sm text-[var(--foreground)]">
                      <span>2026-01-25</span>
                      <span>PAYMENT</span>
                      <span>-₩2,000,000</span>
                      <span>입금</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>
      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Record Payment">
        <div className="grid gap-3">
          <SearchSelect label="party*" placeholder="검색" options={partyOptions} />
          <Input type="date" />
          <Input placeholder="method" />
          <Input type="number" min={0} placeholder="amount" />
          <Textarea placeholder="memo" />
          <div className="flex justify-end">
            <Button onClick={() => setPaymentOpen(false)}>Confirm</Button>
          </div>
        </div>
      </Modal>
      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Record Return">
        <div className="grid gap-3">
          <SearchSelect label="party*" placeholder="검색" options={partyOptions} />
          <SearchSelect label="shipment_line*" placeholder="검색" options={shipmentLineOptions} />
          <Input type="number" min={1} placeholder="return_qty" />
          <Input type="number" min={0} placeholder="amount" />
          <Textarea placeholder="memo" />
          <div className="flex justify-end">
            <Button onClick={() => setReturnOpen(false)}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
