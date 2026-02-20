"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Folder,
  Receipt,
  Plus,
  AlertTriangle,
  RefreshCw,
  FileText,
  DollarSign,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/Card";
import { BudgetProgress } from "@/components/ui/ProgressBar";
import {
  CategoryForm,
  CategoryFormData,
} from "@/components/categories/CategoryForm";
import { formatCurrency } from "@/lib/format";
import type { Expense, FiscalYear, CategoryWithTotals } from "@/types/database";

/* ============================================
   CATEGORY DETAIL PAGE
   ============================================
   Shows full category details with:
   - Category information
   - Budget progress
   - Linked expenses
   - Edit and delete functionality
   ============================================ */

interface CategoryDetailApiResponse {
  category: CategoryWithTotals;
  expenses: Expense[];
  fiscal_year: FiscalYear;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CategoryDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [category, setCategory] = useState<CategoryWithTotals | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toasts, removeToast, toast } = useToast();

  // Fetch category details
  const fetchCategory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Category not found");
        }
        throw new Error("Failed to fetch category");
      }
      const data: CategoryDetailApiResponse = await response.json();
      setCategory(data.category);
      setExpenses(data.expenses);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategory();
  }, [id]);

  // Handle update category
  const handleUpdateCategory = async (formData: CategoryFormData) => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category");
      }

      const updatedCategory = await response.json();
      setCategory(updatedCategory);
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete category
  const handleDeleteCategory = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete category");
      }

      router.push("/categories");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <AppShell data-oid="9lrtno2">
        <div className="animate-pulse space-y-6" data-oid=".i57wz-">
          <div
            className="h-8 w-32 bg-wood-medium/10 rounded"
            data-oid="bm9r:e."
          />
          <div
            className="h-64 bg-wood-medium/10 rounded-lg"
            data-oid="w8q5e0:"
          />
          <div
            className="h-48 bg-wood-medium/10 rounded-lg"
            data-oid="bjv_z48"
          />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error || !category) {
    return (
      <AppShell data-oid="5:as4lc">
        <Card className="bg-ink-red/5 border-ink-red/20" data-oid="kxd3-cw">
          <CardContent className="py-12" data-oid="0z4i:vk">
            <div
              className="flex flex-col items-center justify-center text-center"
              data-oid="py-hyq4"
            >
              <AlertTriangle
                className="w-12 h-12 text-ink-red mb-4"
                data-oid="15.day_"
              />
              <h3
                className="font-serif text-xl font-semibold text-ink-red mb-2"
                data-oid="v364_6s"
              >
                {error || "Category Not Found"}
              </h3>
              <p className="text-sepia mb-6" data-oid="2tfpgzw">
                The requested category could not be loaded.
              </p>
              <Link href="/categories" data-oid="jreu0qp">
                <Button variant="secondary" data-oid="q_z8rxy">
                  <ArrowLeft className="w-4 h-4 mr-2" data-oid="vdq6ndv" />
                  Back to Categories
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  // Edit mode
  if (isEditing) {
    return (
      <AppShell data-oid="uhx7m22">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="mb-6" data-oid="teoc3bw">
          <Link
            href="/categories"
            className="inline-flex items-center text-sm text-sepia hover:text-wood-dark transition-colors"
            data-oid="kgru06u"
          >
            <ArrowLeft className="w-4 h-4 mr-1" data-oid="x_xu3j0" />
            Back to Categories
          </Link>
        </div>

        <CategoryForm
          category={category}
          mode="edit"
          onSubmit={handleUpdateCategory}
          onCancel={() => setIsEditing(false)}
          isLoading={isSaving}
          data-oid="-z28:kt"
        />
      </AppShell>
    );
  }

  return (
    <AppShell data-oid="9tz9k.p">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Back link */}
      <div className="mb-6" data-oid="hj7kivv">
        <Link
          href="/categories"
          className="inline-flex items-center text-sm text-sepia hover:text-wood-dark transition-colors"
          data-oid="-77id58"
        >
          <ArrowLeft className="w-4 h-4 mr-1" data-oid="6xnw:g0" />
          Back to Categories
        </Link>
      </div>

      {/* Category Header */}
      <div
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8"
        data-oid="-g.jn4j"
      >
        <div data-oid="c_zgx6.">
          <div
            className="flex flex-wrap items-center gap-3 mb-2"
            data-oid="8gb_7:u"
          >
            <Folder className="w-6 h-6 text-ink-gold" data-oid="405b:52" />
            <h1
              className="text-3xl font-serif font-bold text-wood-dark"
              data-oid="3e7kwu."
            >
              {category.name}
            </h1>
          </div>

          {category.description && (
            <p className="text-sepia max-w-2xl" data-oid="e60o806">
              {category.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2" data-oid="gi3w_q5">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchCategory}
            data-oid="2bganti"
          >
            <RefreshCw className="w-4 h-4 mr-2" data-oid=":-1.5-i" />
            Refresh
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            leftIcon={<Edit className="w-4 h-4" data-oid="d7npu7p" />}
            data-oid="4g9qex0"
          >
            Edit
          </Button>

          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            leftIcon={<Trash2 className="w-4 h-4" data-oid="ynxx4k." />}
            data-oid="q.lt:ms"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card
          className="mb-6 bg-ink-red/5 border-ink-red/30"
          data-oid="t3c6nar"
        >
          <CardContent className="py-4" data-oid="4hvvl:3">
            <div
              className="flex items-center justify-between"
              data-oid="yrp3fqh"
            >
              <div className="flex items-center gap-3" data-oid="63mmy1f">
                <AlertTriangle
                  className="w-5 h-5 text-ink-red"
                  data-oid="6t4surm"
                />
                <div data-oid="bah37t1">
                  <p className="font-medium text-ink-black" data-oid="1dpc_tp">
                    Are you sure you want to delete this category?
                  </p>
                  <p className="text-sm text-sepia" data-oid="ruix:zi">
                    This action can be undone by an administrator.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2" data-oid="ndqvqkf">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  data-oid="dbojvz8"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteCategory}
                  isLoading={isDeleting}
                  data-oid="ljuzil9"
                >
                  Delete Category
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" data-oid="zohf.m.">
        {/* Left Column - Budget and Expenses */}
        <div className="xl:col-span-2 space-y-6" data-oid=".u8ig7d">
          {/* Budget Overview */}
          <Card data-oid="484v36p">
            <CardHeader data-oid="5cj9azw">
              <CardTitle className="flex items-center gap-2" data-oid="y:wy4i:">
                <DollarSign
                  className="w-5 h-5 text-ink-gold"
                  data-oid="5lxglsh"
                />
                Budget Overview
              </CardTitle>
            </CardHeader>
            <CardContent data-oid="ljxe.m.">
              <BudgetProgress
                label="Category Budget"
                spent={category.actual_spent}
                budget={category.budget_amount}
                data-oid="jeb-5s5"
              />
            </CardContent>
          </Card>

          {/* Expenses List */}
          <Card data-oid="q6ibin5">
            <CardHeader data-oid="ce6zbcj">
              <div
                className="flex items-center justify-between"
                data-oid="5x7m7ni"
              >
                <div data-oid="3vpuuc7">
                  <CardTitle
                    className="flex items-center gap-2"
                    data-oid="dgfy:0g"
                  >
                    <Receipt
                      className="w-5 h-5 text-ink-gold"
                      data-oid="_o.oo3k"
                    />
                    Expenses
                  </CardTitle>
                  <CardDescription data-oid="rrqz2d3">
                    {expenses.length} expense{expenses.length !== 1 ? "s" : ""}{" "}
                    recorded
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" data-oid="7j8v2_u" />}
                  onClick={() =>
                    router.push(`/expenses?category_id=${category.id}`)
                  }
                  data-oid="w5wys7l"
                >
                  Add Expense
                </Button>
              </div>
            </CardHeader>
            <CardContent data-oid="ol3nbpn">
              {expenses.length === 0 ? (
                <div className="text-center py-8" data-oid="-7:yvaz">
                  <Receipt
                    className="w-10 h-10 text-sepia/30 mx-auto mb-3"
                    data-oid="0xol7-k"
                  />
                  <p className="text-sepia" data-oid="wvdihvj">
                    No expenses recorded yet.
                  </p>
                  <p className="text-sm text-sepia/70 mt-1" data-oid="b46j-.p">
                    Add expenses to track spending against this category's
                    budget.
                  </p>
                </div>
              ) : (
                <div className="space-y-3" data-oid="1n:l40m">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
                      data-oid="jdnzjbw"
                    >
                      <div className="flex-1 min-w-0" data-oid=":nf3jjh">
                        <div
                          className="flex items-center gap-2"
                          data-oid="5gj-8m:"
                        >
                          <span
                            className="font-medium text-ink-black"
                            data-oid="hn_vyrf"
                          >
                            {expense.vendor || "Unknown Vendor"}
                          </span>
                          <span
                            className={`
                              text-xs px-2 py-0.5 rounded
                              ${
                                expense.source_type === "brex"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                  : expense.source_type === "pdf"
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300"
                              }
                            `}
                            data-oid="z0x-z-."
                          >
                            {expense.source_type}
                          </span>
                        </div>
                        {expense.memo && (
                          <p
                            className="text-sm text-sepia mt-1 truncate"
                            data-oid="f:gfs3m"
                          >
                            {expense.memo}
                          </p>
                        )}
                        <p
                          className="text-xs text-sepia/70 mt-1"
                          data-oid="790s1i:"
                        >
                          {new Date(expense.expense_date).toLocaleDateString(
                            "en-US",
                            {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </div>
                      <div className="text-right ml-4" data-oid="99w-5x9">
                        <span
                          className="font-serif font-semibold text-lg tabular-nums text-ink-black"
                          data-oid=".jwz6ie"
                        >
                          {formatCurrency(expense.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {expenses.length > 0 && (
              <CardFooter className="justify-between" data-oid="fmlfu2x">
                <span className="text-sm text-sepia" data-oid="r2oxctu">
                  Total Expenses
                </span>
                <span
                  className="font-serif font-bold text-lg tabular-nums text-wood-dark"
                  data-oid="e-rfbnh"
                >
                  {formatCurrency(category.actual_spent)}
                </span>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6" data-oid="8v.1m79">
          {/* Description */}
          {category.description && (
            <Card data-oid="ahtzit9">
              <CardHeader data-oid="i5s8:rw">
                <CardTitle
                  className="flex items-center gap-2"
                  data-oid=":4tfri-"
                >
                  <FileText
                    className="w-5 h-5 text-ink-gold"
                    data-oid="a0f.3m9"
                  />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent data-oid="stoi3gy">
                <p
                  className="text-sm text-sepia whitespace-pre-wrap"
                  data-oid="xg9b0uw"
                >
                  {category.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card data-oid="3fh.:14">
            <CardHeader data-oid="nvevti7">
              <CardTitle className="text-sm" data-oid="xt_q9ap">
                Category Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm" data-oid="6e90qz4">
              <div className="flex justify-between" data-oid="bek-34l">
                <span className="text-sepia" data-oid="hh_6vke">
                  Category ID
                </span>
                <span
                  className="font-mono text-xs text-wood-dark"
                  data-oid="c0x20t0"
                >
                  {category.id}
                </span>
              </div>
              <div className="flex justify-between" data-oid="q1amc94">
                <span className="text-sepia" data-oid="w1svncg">
                  Fiscal Year
                </span>
                <span className="text-wood-dark" data-oid="2zojygx">
                  2026
                </span>
              </div>
              <div className="flex justify-between" data-oid="xefqd4p">
                <span className="text-sepia" data-oid="li5bwxr">
                  Created
                </span>
                <span className="text-wood-dark" data-oid="ubfy.bt">
                  {new Date(category.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between" data-oid="aefoyoc">
                <span className="text-sepia" data-oid=":_shhtg">
                  Last Updated
                </span>
                <span className="text-wood-dark" data-oid="6ssv0nv">
                  {new Date(category.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
