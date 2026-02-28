"use client";

import { useRouter } from "next/navigation";
import {
  DollarSign,
  Receipt,
  Target,
  FileText,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/Card";
import { BudgetProgress } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/lib/format";
import type { EventWithTotals, Expense } from "@/types/database";

/* ============================================
   EVENT DETAILS TAB
   ============================================
   Shows budget overview with progress bar,
   linked expenses list, opportunity goals,
   planning notes, and event metadata.
   Pure display component — no editing state.
   ============================================ */

interface EventDetailsTabProps {
  event: EventWithTotals;
  expenses: Expense[];
}

export function EventDetailsTab({ event, expenses }: EventDetailsTabProps) {
  const router = useRouter();

  return (
    <div
      className="grid grid-cols-1 xl:grid-cols-3 gap-6"
     
    >
      {/* Left Column - Budget and Details */}
      <div className="xl:col-span-2 space-y-6">
        {/* Budget Overview */}
        <Card>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2"
             
            >
              <DollarSign
                className="w-5 h-5 text-spectral"
               
              />
              Budget Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetProgress
              label="Event Budget"
              spent={event.actual_spent}
              budget={event.budget_amount}
             
            />
          </CardContent>
        </Card>

        {/* Expenses List */}
        <Card>
          <CardHeader>
            <div
              className="flex items-center justify-between"
             
            >
              <div>
                <CardTitle
                  className="flex items-center gap-2"
                 
                >
                  <Receipt
                    className="w-5 h-5 text-spectral"
                   
                  />
                  Expenses
                </CardTitle>
                <CardDescription>
                  {expenses.length} expense
                  {expenses.length !== 1 ? "s" : ""} recorded
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() =>
                  router.push(`/expenses?event_id=${event.id}`)
                }
               
              >
                Add Expense
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-8">
                <Receipt
                  className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3"
                 
                />
                <p className="text-muted-foreground">
                  No expenses recorded yet.
                </p>
                <p
                  className="text-sm text-muted-foreground/60 mt-1"
                 
                >
                  Add expenses to track spending against this event's
                  budget.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-background border border-border hover:border-border transition-colors"
                   
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="flex items-center gap-2"
                       
                      >
                        <span
                          className="font-medium text-foreground"
                         
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
                         
                        >
                          {expense.source_type}
                        </span>
                      </div>
                      {expense.memo && (
                        <p
                          className="text-sm text-muted-foreground mt-1 truncate"
                         
                        >
                          {expense.memo}
                        </p>
                      )}
                      <p
                        className="text-xs text-muted-foreground/60 mt-1"
                       
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
                    <div className="text-right ml-4">
                      <span
                        className="font-semibold text-lg tabular-nums text-foreground"
                       
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
            <CardFooter className="justify-between">
              <span className="text-sm text-muted-foreground">
                Total Expenses
              </span>
              <span
                className="font-bold text-lg tabular-nums text-foreground"
               
              >
                {formatCurrency(event.actual_spent)}
              </span>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Right Column - Goals and Notes */}
      <div className="space-y-6">
        {/* Opportunity Goals */}
        {(event.expansion_goal > 0 || event.net_new_goal > 0) && (
          <Card>
            <CardHeader>
              <CardTitle
                className="flex items-center gap-2"
               
              >
                <Target
                  className="w-5 h-5 text-spectral"
                 
                />
                Opportunity Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.expansion_goal > 0 && (
                <div
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
                 
                >
                  <span className="text-muted-foreground">
                    Expansion
                  </span>
                  <span
                    className="font-semibold text-xl tabular-nums text-foreground"
                   
                  >
                    {event.expansion_goal}
                  </span>
                </div>
              )}
              {event.net_new_goal > 0 && (
                <div
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
                 
                >
                  <span className="text-muted-foreground">
                    Net New
                  </span>
                  <span
                    className="font-semibold text-xl tabular-nums text-emerald-400"
                   
                  >
                    {event.net_new_goal}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Planning Notes */}
        {(event.approach_notes ||
          event.marketing_notes ||
          event.sales_notes) && (
          <Card>
            <CardHeader>
              <CardTitle
                className="flex items-center gap-2"
               
              >
                <FileText
                  className="w-5 h-5 text-spectral"
                 
                />
                Planning Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.approach_notes && (
                <div>
                  <h4
                    className="text-sm font-medium text-foreground mb-1"
                   
                  >
                    Approach
                  </h4>
                  <p
                    className="text-sm text-muted-foreground whitespace-pre-wrap"
                   
                  >
                    {event.approach_notes}
                  </p>
                </div>
              )}
              {event.marketing_notes && (
                <div>
                  <h4
                    className="text-sm font-medium text-foreground mb-1"
                   
                  >
                    Marketing
                  </h4>
                  <p
                    className="text-sm text-muted-foreground whitespace-pre-wrap"
                   
                  >
                    {event.marketing_notes}
                  </p>
                </div>
              )}
              {event.sales_notes && (
                <div>
                  <h4
                    className="text-sm font-medium text-foreground mb-1"
                   
                  >
                    Sales
                  </h4>
                  <p
                    className="text-sm text-muted-foreground whitespace-pre-wrap"
                   
                  >
                    {event.sales_notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Event ID
              </span>
              <span
                className="font-mono text-xs text-foreground"
               
              >
                {event.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Fiscal Year
              </span>
              <span className="text-foreground">
                2026
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Created
              </span>
              <span className="text-foreground">
                {new Date(event.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Last Updated
              </span>
              <span className="text-foreground">
                {new Date(event.updated_at).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
