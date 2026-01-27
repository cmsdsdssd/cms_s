"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// Mock Data for Lookup Grid
const MOCK_ITEMS = Array.from({ length: 20 }).map((_, i) => ({
    id: `ORD-${20260001 + i}`,
    date: "2026-01-27",
    customer: i % 2 === 0 ? "Gold Boutique" : "Silver Star Store",
    model: `J-${100 + i}-A`,
    color: i % 3 === 0 ? "Rose Gold" : "Yellow Gold",
    plating: i % 2 === 0 ? "Yes" : "No",
    platingColor: i % 2 === 0 ? "Rose" : "-",
    category: "Ring",
    size: "12",
    note: "Urgent delivery",
    weight: (3.5 + i * 0.1).toFixed(2),
    labor: (50 + i * 5).toFixed(2),
}));

export default function ShippingPage() {
    const [isLookupOpen, setIsLookupOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<typeof MOCK_ITEMS[0] | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const handleSearchFocus = () => {
        setIsLookupOpen(true);
    };

    const handleItemSelect = (item: typeof MOCK_ITEMS[0]) => {
        setSelectedItem(item);
        setIsLookupOpen(false);
    };

    return (
        <div className="flex flex-col h-screen bg-[#f8f9fc] font-[family-name:var(--font-manrope)] text-[var(--foreground)] overflow-hidden relative">

            {/* --- Top Search Bar --- */}
            <div className="bg-white p-3 shrink-0 shadow-sm z-20 relative border-b border-[var(--panel-border)]">
                <div className="relative max-w-4xl mx-auto w-full">
                    <svg className="absolute left-4 top-2.5 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <Input
                        className="h-10 text-sm pl-11 bg-gray-50 border-gray-200 focus:border-[#d4af37] focus:ring-[#d4af37]"
                        placeholder="Search Order No, Customer, or Model..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={() => setIsLookupOpen(true)}
                    />
                </div>
            </div>

            {/* --- Main Content Area (Detail View) --- */}
            <div className="flex-1 overflow-hidden p-4 transition-all duration-300">
                <div className="max-w-6xl mx-auto h-full flex flex-col md:flex-row gap-4 items-start">

                    {/* Left: Image Display (View Only) */}
                    <div className="w-full md:w-[400px] shrink-0 flex flex-col">
                        <Card className="aspect-square w-full bg-white border border-[var(--panel-border)] shadow-sm flex items-center justify-center relative overflow-hidden">
                            {selectedItem ? (
                                <div className="flex flex-col items-center justify-center text-[var(--muted-weak)]">
                                    <svg className="w-20 h-20 mb-2 text-[#d4af37]/20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" /></svg>
                                    <span className="text-xs font-serif italic">Product Image</span>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-[#d4af37]/5 to-transparent pointer-events-none"></div>
                                </div>
                            ) : (
                                <div className="text-gray-300 text-center text-sm">
                                    <p>Select item to view</p>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Right: 2-Column Form */}
                    <Card className="flex-1 w-full md:h-[400px] bg-white border border-[var(--panel-border)] shadow-sm p-5 overflow-hidden flex flex-col justify-between">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {/* Row 1 */}
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Order Date</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.date || ""} readOnly />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Customer</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.customer || ""} readOnly />
                            </div>

                            {/* Row 2 */}
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Model Name</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.model || ""} readOnly />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Color</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.color || ""} readOnly />
                            </div>

                            {/* Row 3 */}
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Plating Status</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.plating || ""} readOnly />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Plating Color</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.platingColor || ""} readOnly />
                            </div>

                            {/* Row 4 */}
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Category</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.category || ""} readOnly />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Size</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.size || ""} readOnly />
                            </div>

                            {/* Row 5 */}
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Note</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200" value={selectedItem?.note || ""} readOnly />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Weight (g)</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200 font-mono" value={selectedItem?.weight || ""} readOnly />
                            </div>

                            {/* Row 6 */}
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Total Labor ($)</label>
                                <Input className="h-7 text-xs bg-gray-50 border-gray-200 font-mono" value={selectedItem?.labor || ""} readOnly />
                            </div>
                        </div>

                        <div className="mt-2 text-right">
                            <Button className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wide shadow-sm text-xs">
                                CONFIRM SHIPMENT
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- Lookup Grid Overlay (Bottom Sheet) --- */}
            <div className={cn(
                "absolute bottom-0 left-0 right-0 bg-white border-t border-[var(--panel-border)] shadow-2xl transition-transform duration-500 ease-in-out z-30 flex flex-col",
                isLookupOpen ? "translate-y-0 h-[60vh]" : "translate-y-full h-[60vh]"
            )}>
                <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-[#f8f9fc] shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-base text-[#1a1a1a]">Order Lookup</span>
                        <span className="text-[10px] text-[var(--muted)] bg-white px-1.5 py-0.5 rounded border border-gray-200">Total {MOCK_ITEMS.length}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setIsLookupOpen(false)} className="hover:bg-gray-200 rounded-full h-7 w-7 p-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" type="button"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </Button>
                </div>

                <div className="flex-1 overflow-auto p-3 bg-gray-50">
                    <div className="bg-white rounded border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-[var(--muted-strong)] font-bold uppercase text-[10px]">
                                <tr>
                                    <th className="p-2 border-b">Order No</th>
                                    <th className="p-2 border-b">Date</th>
                                    <th className="p-2 border-b">Customer</th>
                                    <th className="p-2 border-b">Model</th>
                                    <th className="p-2 border-b">Color</th>
                                    <th className="p-2 border-b text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                                {MOCK_ITEMS.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-yellow-50 cursor-pointer transition-colors"
                                        onClick={() => handleItemSelect(item)}
                                    >
                                        <td className="p-2 font-medium text-blue-600">{item.id}</td>
                                        <td className="p-2 text-[var(--muted-strong)]">{item.date}</td>
                                        <td className="p-2 font-bold text-gray-700">{item.customer}</td>
                                        <td className="p-2 text-gray-600">{item.model}</td>
                                        <td className="p-2 text-gray-600">{item.color}</td>
                                        <td className="p-2 text-right">
                                            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-green-100 text-green-700 font-bold border border-green-200">READY</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Overlay Backdrop */}
            {isLookupOpen && (
                <div
                    className="absolute inset-0 bg-black/20 backdrop-blur-sm z-10 transition-opacity"
                    onClick={() => setIsLookupOpen(false)}
                ></div>
            )}

        </div>
    );
}
