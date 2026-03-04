"use client";

import { useState, useMemo } from "react";
import { Folder, AlertTriangle, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CategoryCard } from "./CategoryCard";
import { formatCurrency } from "@/lib/format";
import type { Expense, CategoryWithTotals } from "@/types/database";

/* ============================================
   CATEGORY LIST COMPONENT
   ============================================
   Ghostly-themed list of budget categories
   with search and summary statistics.
   ============================================ */

export interface CategoryListProps {
  /** List of categories to display */
  categories: CategoryWithTotals[];
  /** Map of category IDs to their expenses (for expandable rows) */
  expensesByCategory?: Record<string, Expense[]>;
  /** Whether to show expandable expense rows */
  expandable?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Show search input */
  showSearch?: boolean;
}

export function CategoryList({
  categories,
  expensesByCategory = {},
  expandable = false,
  isLoading = false,
  error = null,
  showSearch = true,
}: CategoryListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories;
    }

    const query = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query),
    );
  }, [categories, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredCategories.reduce(
      (acc, category) => ({
        budget: acc.budget + category.budget_amount,
        actual: acc.actual + category.actual_spent,
        count: acc.count + 1,
      }),
      { budget: 0, actual: 0, count: 0 },
    );
  }, [filteredCategories]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div
          className="h-12 bg-spectral/10 rounded animate-pulse"
         
        />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 bg-spectral/10 rounded-lg animate-pulse"
           
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-red-400/10 border-destructive/20">
        <CardContent className="py-12">
          <div
            className="flex flex-col items-center justify-center text-center"
           
          >
            <AlertTriangle
              className="w-12 h-12 text-destructive mb-4"
             
            />
            <h3
              className="text-xl font-semibold text-destructive mb-2"
             
            >
              Failed to Load Categories
            </h3>
            <p className="text-muted-foreground">
              {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      {showSearch && (
        <div className="flex justify-end">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
             
            />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                pl-10 pr-4 py-2 rounded-md w-full lg:w-64
                bg-background border border-border
                text-foreground placeholder:text-muted-foreground/50
                focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
                transition-colors duration-200
              "
             
            />
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div
        className="flex flex-wrap items-center gap-4 py-3 px-4 bg-card rounded-lg border border-border"
       
      >
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {totals.count}
          </span>{" "}
          categories
        </span>
        <span className="text-muted-foreground/30">
          |
        </span>
        <span className="text-sm text-muted-foreground">
          Budget:{" "}
          <span
            className="font-semibold tabular-nums text-foreground"
           
          >
            {formatCurrency(totals.budget)}
          </span>
        </span>
        <span className="text-muted-foreground/30">
          |
        </span>
        <span className="text-sm text-muted-foreground">
          Spent:{" "}
          <span
            className="font-semibold tabular-nums text-foreground"
           
          >
            {formatCurrency(totals.actual)}
          </span>
        </span>
        <span className="text-muted-foreground/30">
          |
        </span>
        <span className="text-sm text-muted-foreground">
          Remaining:{" "}
          <span
            className={`font-semibold tabular-nums ${
              totals.budget - totals.actual < 0
                ? "text-destructive"
                : "text-emerald-400"
            }`}
           
          >
            {formatCurrency(totals.budget - totals.actual)}
          </span>
        </span>
      </div>

      {/* Categories list */}
      {filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div
              className="flex flex-col items-center justify-center text-center"
             
            >
              <Folder
                className="w-12 h-12 text-muted-foreground/60 mb-4"
               
              />
              <h3
                className="text-xl font-semibold text-foreground mb-2"
               
              >
                No Categories Found
              </h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search query."
                  : "No budget categories have been created yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              expenses={expensesByCategory[category.id]}
              expandable={expandable}
             
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryList;
