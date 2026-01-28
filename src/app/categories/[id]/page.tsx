'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
} from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { BudgetProgress } from '@/components/ui/ProgressBar';
import { CategoryForm, CategoryFormData } from '@/components/categories/CategoryForm';
import type { Expense, FiscalYear, CategoryWithTotals } from '@/types/database';

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

  // Fetch category details
  const fetchCategory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Category not found');
        }
        throw new Error('Failed to fetch category');
      }
      const data: CategoryDetailApiResponse = await response.json();
      setCategory(data.category);
      setExpenses(data.expenses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update category');
      }

      const updatedCategory = await response.json();
      setCategory(updatedCategory);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete category
  const handleDeleteCategory = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete category');
      }

      router.push('/categories');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete category');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-wood-medium/10 rounded" />
          <div className="h-64 bg-wood-medium/10 rounded-lg" />
          <div className="h-48 bg-wood-medium/10 rounded-lg" />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error || !category) {
    return (
      <AppShell>
        <Card className="bg-ink-red/5 border-ink-red/20">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-12 h-12 text-ink-red mb-4" />
              <h3 className="font-serif text-xl font-semibold text-ink-red mb-2">
                {error || 'Category Not Found'}
              </h3>
              <p className="text-sepia mb-6">
                The requested category could not be loaded.
              </p>
              <Link href="/categories">
                <Button variant="secondary">
                  <ArrowLeft className="w-4 h-4 mr-2" />
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
      <AppShell>
        <div className="mb-6">
          <Link
            href="/categories"
            className="inline-flex items-center text-sm text-sepia hover:text-wood-dark transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Categories
          </Link>
        </div>

        <CategoryForm
          category={category}
          mode="edit"
          onSubmit={handleUpdateCategory}
          onCancel={() => setIsEditing(false)}
          isLoading={isSaving}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/categories"
          className="inline-flex items-center text-sm text-sepia hover:text-wood-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Categories
        </Link>
      </div>

      {/* Category Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <Folder className="w-6 h-6 text-ink-gold" />
            <h1 className="text-3xl font-serif font-bold text-wood-dark">
              {category.name}
            </h1>
          </div>

          {category.description && (
            <p className="text-sepia max-w-2xl">
              {category.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchCategory}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            leftIcon={<Edit className="w-4 h-4" />}
          >
            Edit
          </Button>

          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card className="mb-6 bg-ink-red/5 border-ink-red/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-ink-red" />
                <div>
                  <p className="font-medium text-ink-black">
                    Are you sure you want to delete this category?
                  </p>
                  <p className="text-sm text-sepia">
                    This action can be undone by an administrator.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteCategory}
                  isLoading={isDeleting}
                >
                  Delete Category
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Budget and Expenses */}
        <div className="xl:col-span-2 space-y-6">
          {/* Budget Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-ink-gold" />
                Budget Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetProgress
                label="Category Budget"
                spent={category.actual_spent}
                budget={category.budget_amount}
              />
            </CardContent>
          </Card>

          {/* Expenses List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-ink-gold" />
                    Expenses
                  </CardTitle>
                  <CardDescription>
                    {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => router.push(`/expenses?category_id=${category.id}`)}
                >
                  Add Expense
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-10 h-10 text-sepia/30 mx-auto mb-3" />
                  <p className="text-sepia">No expenses recorded yet.</p>
                  <p className="text-sm text-sepia/70 mt-1">
                    Add expenses to track spending against this category's budget.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-black">
                            {expense.vendor || 'Unknown Vendor'}
                          </span>
                          <span
                            className={`
                              text-xs px-2 py-0.5 rounded
                              ${expense.source_type === 'brex' ? 'bg-blue-100 text-blue-700' :
                                expense.source_type === 'pdf' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'}
                            `}
                          >
                            {expense.source_type}
                          </span>
                        </div>
                        {expense.memo && (
                          <p className="text-sm text-sepia mt-1 truncate">
                            {expense.memo}
                          </p>
                        )}
                        <p className="text-xs text-sepia/70 mt-1">
                          {new Date(expense.expense_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <span className="font-serif font-semibold text-lg tabular-nums text-ink-black">
                          {formatCurrency(expense.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {expenses.length > 0 && (
              <CardFooter className="justify-between">
                <span className="text-sm text-sepia">Total Expenses</span>
                <span className="font-serif font-bold text-lg tabular-nums text-wood-dark">
                  {formatCurrency(category.actual_spent)}
                </span>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6">
          {/* Description */}
          {category.description && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-ink-gold" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-sepia whitespace-pre-wrap">
                  {category.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Category Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-sepia">Category ID</span>
                <span className="font-mono text-xs text-wood-dark">{category.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sepia">Fiscal Year</span>
                <span className="text-wood-dark">2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sepia">Created</span>
                <span className="text-wood-dark">
                  {new Date(category.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sepia">Last Updated</span>
                <span className="text-wood-dark">
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
