"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { 
  ClipboardList, 
  PackageCheck, 
  CreditCard, 
  RotateCcw,
  Clock,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Package,
  Wrench,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type TimelineItemType = 
  | "order" 
  | "shipment" 
  | "payment" 
  | "return" 
  | "repair" 
  | "inventory";

export type TimelineItemStatus = 
  | "pending" 
  | "completed" 
  | "cancelled" 
  | "in_progress";

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  status: TimelineItemStatus;
  title: string;
  subtitle?: string;
  date: Date;
  amount?: number;
  qty?: number;
  color?: string;
  modelName?: string;
  partyName?: string;
  expanded?: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "secondary" | "ghost";
  }>;
  details?: React.ReactNode;
}

interface TimelineViewProps {
  items: TimelineItem[];
  groupByDate?: boolean;
  onItemExpand?: (id: string) => void;
  onItemCollapse?: (id: string) => void;
  showTypeBadge?: boolean;
  className?: string;
}

const typeConfig: Record<TimelineItemType, {
  icon: React.ElementType;
  label: string;
  badgeLabel: string;
  color: string;
  bgColor: string;
}> = {
  order: {
    icon: ClipboardList,
    label: "주문",
    badgeLabel: "ORDER",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  shipment: {
    icon: PackageCheck,
    label: "출고",
    badgeLabel: "SHIPMENT",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  payment: {
    icon: CreditCard,
    label: "수금",
    badgeLabel: "PAYMENT",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  return: {
    icon: RotateCcw,
    label: "반품",
    badgeLabel: "RETURN",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  repair: {
    icon: Wrench,
    label: "수리",
    badgeLabel: "REPAIR",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  inventory: {
    icon: Package,
    label: "재고",
    badgeLabel: "INVENTORY",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
};

const statusConfig: Record<TimelineItemStatus, {
  label: string;
  tone: "neutral" | "active" | "danger" | "warning";
  icon?: React.ElementType;
}> = {
  pending: {
    label: "대기",
    tone: "neutral",
  },
  in_progress: {
    label: "진행중",
    tone: "warning",
  },
  completed: {
    label: "완료",
    tone: "active",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "취소",
    tone: "danger",
    icon: AlertCircle,
  },
};

function TimelineItemCard({
  item,
  onExpand,
  onCollapse,
  showTypeBadge,
}: {
  item: TimelineItem;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
  showTypeBadge?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(item.expanded || false);
  
  const typeInfo = typeConfig[item.type];
  const statusInfo = statusConfig[item.status];
  const TypeIcon = typeInfo.icon;
  const StatusIcon = statusInfo.icon;

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded && onExpand) {
      onExpand(item.id);
    } else if (!newExpanded && onCollapse) {
      onCollapse(item.id);
    }
  };

  return (
    <div className={cn(
      "group rounded-xl border transition-all duration-200",
      "hover:shadow-md hover:border-primary/20",
      isExpanded ? "bg-card shadow-md border-primary/20" : "bg-card/50 border-border"
    )}>
      {/* Header */}
      <div 
        className="flex items-start gap-4 p-4 cursor-pointer"
        onClick={handleToggle}
      >
        {/* Icon */}
        <div className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-colors",
          typeInfo.bgColor
        )}>
          <TypeIcon className={cn("w-6 h-6", typeInfo.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{item.title}</span>
                {showTypeBadge && (
                  <Badge tone="neutral" className="text-[10px] font-semibold tracking-wide">
                    {typeInfo.badgeLabel}
                  </Badge>
                )}
                <Badge 
                  tone={statusInfo.tone}
                  className="text-xs"
                >
                  {statusInfo.label}
                </Badge>
              </div>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {item.subtitle}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {item.amount !== undefined && (
                <span className="font-semibold text-foreground">
                  ₩{item.amount.toLocaleString()}
                </span>
              )}
              {item.qty !== undefined && (
                <span className="text-sm text-muted-foreground">
                  {item.qty}개
                </span>
              )}
              <ChevronDown className={cn(
                "w-5 h-5 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )} />
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {format(item.date, "MM/dd HH:mm", { locale: ko })}
            </span>
            {item.modelName && (
              <span className="px-2 py-0.5 rounded-full bg-muted">
                {item.modelName}
              </span>
            )}
            {item.color && (
              <span className="px-2 py-0.5 rounded-full bg-muted">
                {item.color}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border/50">
          {item.details && (
            <div className="py-3">
              {item.details}
            </div>
          )}
          
          {/* Actions */}
          {item.actions && item.actions.length > 0 && (
            <div className="flex items-center gap-2 pt-3 border-t border-border/50">
              {item.actions.map((action, idx) => (
                <Button
                  key={idx}
                  variant={action.variant === "default" ? "primary" : action.variant || "secondary"}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function groupItemsByDate(items: TimelineItem[]): Map<string, TimelineItem[]> {
  const groups = new Map<string, TimelineItem[]>();
  
  items.forEach(item => {
    const dateKey = format(item.date, "yyyy-MM-dd");
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(item);
  });
  
  return groups;
}

export function TimelineView({
  items,
  groupByDate = true,
  onItemExpand,
  onItemCollapse,
  showTypeBadge = false,
  className,
}: TimelineViewProps) {
  const sortedItems = [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
  
  if (groupByDate) {
    const grouped = groupItemsByDate(sortedItems);
    const dateKeys = Array.from(grouped.keys()).sort().reverse();
    
    return (
      <div className={cn("space-y-6", className)}>
        {dateKeys.map(dateKey => {
          const dateItems = grouped.get(dateKey)!;
          const isToday = dateKey === format(new Date(), "yyyy-MM-dd");
          const isYesterday = dateKey === format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
          
          let dateLabel = format(new Date(dateKey), "M월 d일 EEEE", { locale: ko });
          if (isToday) dateLabel = "오늘";
          if (isYesterday) dateLabel = "어제";
          
          return (
            <div key={dateKey} className="space-y-3">
              <div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                <h3 className="text-sm font-semibold text-foreground">
                  {dateLabel}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  {dateItems.length}건
                </span>
              </div>
              
              <div className="space-y-3">
                {dateItems.map((item, idx) => (
                  <TimelineItemCard
                    key={`${item.type}-${item.id}-${idx}`}
                    item={item}
                    onExpand={onItemExpand}
                    onCollapse={onItemCollapse}
                    showTypeBadge={showTypeBadge}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {sortedItems.map((item, idx) => (
        <TimelineItemCard
          key={`${item.type}-${item.id}-${idx}`}
          item={item}
          onExpand={onItemExpand}
          onCollapse={onItemCollapse}
          showTypeBadge={showTypeBadge}
        />
      ))}
    </div>
  );
}

// Empty state
export function TimelineEmpty({
  message = "해당 기간에 업무 내역이 없습니다",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Clock className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

// Filter tabs
export function TimelineFilter({
  current,
  onChange,
  counts,
}: {
  current: TimelineItemType | "all";
  onChange: (type: TimelineItemType | "all") => void;
  counts?: Record<TimelineItemType | "all", number>;
}) {
  const filters: Array<{ type: TimelineItemType | "all"; label: string }> = [
    { type: "all", label: "전체" },
    { type: "order", label: "주문" },
    { type: "shipment", label: "출고" },
    { type: "payment", label: "수금" },
    { type: "return", label: "반품" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg overflow-x-auto">
      {filters.map(({ type, label }) => {
        const count = counts?.[type];
        const isActive = current === type;
        
        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn(
                "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                isActive ? "bg-primary/10 text-primary" : "bg-muted-foreground/20"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
