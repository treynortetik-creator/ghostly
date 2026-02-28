"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";

/* ============================================
   CONFIGURABLE LIST SECTION
   ============================================
   Reusable component for managing a list of
   { id, label, sort_order } items. Used for
   checklist phases and note types.
   ============================================ */

export interface ConfigItem {
  id: string;
  label: string;
  sort_order: number;
}

interface ConfigurableListSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description: string;
  /** Section icon */
  icon: React.ReactNode;
  /** Current items */
  items: ConfigItem[];
  /** Called when items change */
  onChange: (items: ConfigItem[]) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
}

export function ConfigurableListSection({
  title,
  description,
  icon,
  items,
  onChange,
  disabled = false,
}: ConfigurableListSectionProps) {
  const [newLabel, setNewLabel] = useState("");

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const id = newLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!id) return;

    // Check for duplicate id
    if (items.some((item) => item.id === id)) return;

    const maxOrder = items.reduce((max, item) => Math.max(max, item.sort_order), -1);
    onChange([...items, { id, label: newLabel.trim(), sort_order: maxOrder + 1 }]);
    setNewLabel("");
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    // Re-index sort_order
    onChange(newItems.map((item, i) => ({ ...item, sort_order: i })));
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    // Re-index sort_order
    onChange(newItems.map((item, i) => ({ ...item, sort_order: i })));
  };

  const handleLabelChange = (id: string, label: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, label } : item)));
  };

  // Sort items by sort_order for display
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-spectral/10 text-spectral">
            {icon}
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Items list */}
        {sortedItems.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-3 py-2 bg-background rounded-md border border-border group"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <input
              type="text"
              value={item.label}
              onChange={(e) => handleLabelChange(item.id, e.target.value)}
              disabled={disabled}
              className="flex-1 bg-transparent text-sm text-foreground border-none focus:outline-none focus:ring-0 disabled:opacity-50"
            />
            <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">
              {item.id}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleMoveUp(index)}
                disabled={disabled || index === 0}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Move up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleMoveDown(index)}
                disabled={disabled || index === sortedItems.length - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Move down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleRemove(item.id)}
                disabled={disabled || sortedItems.length <= 1}
                className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Add new item */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add new..."
            disabled={disabled}
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAdd}
            disabled={disabled || !newLabel.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ConfigurableListSection;
