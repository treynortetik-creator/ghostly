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
      <div className="space-y-4" data-oid="oc11j8r">
        <div
          className="h-12 bg-spectral/10 rounded animate-pulse"
          data-oid="_xnvf2z"
        />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 bg-spectral/10 rounded-lg animate-pulse"
            data-oid="egb4u0a"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-red-400/10 border-destructive/20" data-oid="8rfy4oy">
        <CardContent className="py-12" data-oid="chjh.ht">
          <div
            className="flex flex-col items-center justify-center text-center"
            data-oid="79:v5pr"
          >
            <AlertTriangle
              className="w-12 h-12 text-destructive mb-4"
              data-oid="vhjim.m"
            />
            <h3
              className="text-xl font-semibold text-destructive mb-2"
              data-oid="pr9uva6"
            >
              Failed to Load Categories
            </h3>
            <p className="text-muted-foreground" data-oid="oxyjf13">
              {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-oid="3qtp-40">
      {/* Search */}
      {showSearch && (
        <div className="flex justify-end" data-oid="ummi78x">
          <div className="relative" data-oid="_qbzerr">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              data-oid="2p04218"
            />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                pl-10 pr-4 py-2 rounded-md w-full lg:w-64
                bg-background border border-border
                text-foreground placeholder-muted-foreground/50
                focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
                transition-colors duration-200
              "
              data-oid="ftcly_e"
            />
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div
        className="flex flex-wrap items-center gap-4 py-3 px-4 bg-card rounded-lg border border-border"
        data-oid="-diiog1"
      >
        <span className="text-sm text-muted-foreground" data-oid="_pvwuuw">
          <span className="font-semibold text-foreground" data-oid="js7t6yw">
            {totals.count}
          </span>{" "}
          categories
        </span>
        <span className="text-muted-foreground/30" data-oid="z4cwanc">
          |
        </span>
        <span className="text-sm text-muted-foreground" data-oid="ydrhr:1">
          Budget:{" "}
          <span
            className="font-semibold tabular-nums text-foreground"
            data-oid="jcuom4."
          >
            {formatCurrency(totals.budget)}
          </span>
        </span>
        <span className="text-muted-foreground/30" data-oid="03.4vfo">
          |
        </span>
        <span className="text-sm text-muted-foreground" data-oid="9yl9nrq">
          Spent:{" "}
          <span
            className="font-semibold tabular-nums text-foreground"
            data-oid="in3sr0u"
          >
            {formatCurrency(totals.actual)}
          </span>
        </span>
        <span className="text-muted-foreground/30" data-oid="cx7g2ep">
          |
        </span>
        <span className="text-sm text-muted-foreground" data-oid="39i86l4">
          Remaining:{" "}
          <span
            className={`font-semibold tabular-nums ${
              totals.budget - totals.actual < 0
                ? "text-destructive"
                : "text-emerald-400"
            }`}
            data-oid=".xh0cwn"
          >
            {formatCurrency(totals.budget - totals.actual)}
          </span>
        </span>
      </div>

      {/* Categories list */}
      {filteredCategories.length === 0 ? (
        <Card data-oid="-4poiyo">
          <CardContent className="py-12" data-oid="17ajar1">
            <div
              className="flex flex-col items-center justify-center text-center"
              data-oid="l4n:e_0"
            >
              <Folder
                className="w-12 h-12 text-muted-foreground/60 mb-4"
                data-oid="ghk571q"
              />
              <h3
                className="text-xl font-semibold text-foreground mb-2"
                data-oid="wsv0tw7"
              >
                No Categories Found
              </h3>
              <p className="text-muted-foreground" data-oid="fa7nlkk">
                {searchQuery
                  ? "Try adjusting your search query."
                  : "No budget categories have been created yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-oid="p:47lm7">
          {filteredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              expenses={expensesByCategory[category.id]}
              expandable={expandable}
              data-oid="erwxibi"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryList;
