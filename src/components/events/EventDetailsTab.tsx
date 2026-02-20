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
      data-oid="knvtjp7"
    >
      {/* Left Column - Budget and Details */}
      <div className="xl:col-span-2 space-y-6" data-oid="lmm8630">
        {/* Budget Overview */}
        <Card data-oid="snubk2v">
          <CardHeader data-oid="9mhh.zo">
            <CardTitle
              className="flex items-center gap-2"
              data-oid="kqk1wd-"
            >
              <DollarSign
                className="w-5 h-5 text-ink-gold"
                data-oid="sb62cj9"
              />
              Budget Overview
            </CardTitle>
          </CardHeader>
          <CardContent data-oid="kjqf8pj">
            <BudgetProgress
              label="Event Budget"
              spent={event.actual_spent}
              budget={event.budget_amount}
              data-oid="3xoql8y"
            />
          </CardContent>
        </Card>

        {/* Expenses List */}
        <Card data-oid="o.og8m5">
          <CardHeader data-oid="oyxyyam">
            <div
              className="flex items-center justify-between"
              data-oid=".5ah58y"
            >
              <div data-oid="j_h40qz">
                <CardTitle
                  className="flex items-center gap-2"
                  data-oid="fti5a1e"
                >
                  <Receipt
                    className="w-5 h-5 text-ink-gold"
                    data-oid="wnvxwl4"
                  />
                  Expenses
                </CardTitle>
                <CardDescription data-oid="iz4no1t">
                  {expenses.length} expense
                  {expenses.length !== 1 ? "s" : ""} recorded
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" data-oid="vtbmmqu" />}
                onClick={() =>
                  router.push(`/expenses?event_id=${event.id}`)
                }
                data-oid="u6zo5.9"
              >
                Add Expense
              </Button>
            </div>
          </CardHeader>
          <CardContent data-oid="qo74a9-">
            {expenses.length === 0 ? (
              <div className="text-center py-8" data-oid="7ey88up">
                <Receipt
                  className="w-10 h-10 text-sepia/30 mx-auto mb-3"
                  data-oid="8.qbh64"
                />
                <p className="text-sepia" data-oid="av0a4_:">
                  No expenses recorded yet.
                </p>
                <p
                  className="text-sm text-sepia/70 mt-1"
                  data-oid="ar8cqve"
                >
                  Add expenses to track spending against this event's
                  budget.
                </p>
              </div>
            ) : (
              <div className="space-y-3" data-oid="lfxuv0x">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
                    data-oid="8ns_66k"
                  >
                    <div className="flex-1 min-w-0" data-oid="vsdp-c:">
                      <div
                        className="flex items-center gap-2"
                        data-oid="dtmtr44"
                      >
                        <span
                          className="font-medium text-ink-black"
                          data-oid="b6g.jt3"
                        >
                          {expense.vendor || "Unknown Vendor"}
                        </span>
                        <span
                          className={`
                          text-xs px-2 py-0.5 rounded
                          ${
                            expense.source_type === "brex"
                              ? "bg-blue-100 text-blue-700"
                              : expense.source_type === "pdf"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-700"
                          }
                        `}
                          data-oid="2q0ctvr"
                        >
                          {expense.source_type}
                        </span>
                      </div>
                      {expense.memo && (
                        <p
                          className="text-sm text-sepia mt-1 truncate"
                          data-oid="hkxme.h"
                        >
                          {expense.memo}
                        </p>
                      )}
                      <p
                        className="text-xs text-sepia/70 mt-1"
                        data-oid="s6y:2dv"
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
                    <div className="text-right ml-4" data-oid=":.wjhs-">
                      <span
                        className="font-serif font-semibold text-lg tabular-nums text-ink-black"
                        data-oid="o7q.ypc"
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
            <CardFooter className="justify-between" data-oid="b.b9q5i">
              <span className="text-sm text-sepia" data-oid="dhz17.v">
                Total Expenses
              </span>
              <span
                className="font-serif font-bold text-lg tabular-nums text-wood-dark"
                data-oid="uw1fnuc"
              >
                {formatCurrency(event.actual_spent)}
              </span>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Right Column - Goals and Notes */}
      <div className="space-y-6" data-oid=":36kxyi">
        {/* Opportunity Goals */}
        {(event.expansion_goal > 0 || event.net_new_goal > 0) && (
          <Card data-oid="u55t_5x">
            <CardHeader data-oid="1v5hqfr">
              <CardTitle
                className="flex items-center gap-2"
                data-oid="99gnf8q"
              >
                <Target
                  className="w-5 h-5 text-ink-gold"
                  data-oid="h1twci6"
                />
                Opportunity Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" data-oid="orx7m9.">
              {event.expansion_goal > 0 && (
                <div
                  className="flex items-center justify-between p-3 rounded-lg bg-parchment border border-wood-medium/20"
                  data-oid="g71kywl"
                >
                  <span className="text-sepia" data-oid="uc7mac8">
                    Expansion
                  </span>
                  <span
                    className="font-serif font-semibold text-xl tabular-nums text-ink-black"
                    data-oid="etpbyc."
                  >
                    {event.expansion_goal}
                  </span>
                </div>
              )}
              {event.net_new_goal > 0 && (
                <div
                  className="flex items-center justify-between p-3 rounded-lg bg-parchment border border-wood-medium/20"
                  data-oid="6u0v49i"
                >
                  <span className="text-sepia" data-oid="avusurm">
                    Net New
                  </span>
                  <span
                    className="font-serif font-semibold text-xl tabular-nums text-ink-green"
                    data-oid="g6:pild"
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
          <Card data-oid="ig66:dj">
            <CardHeader data-oid="2gh.lg3">
              <CardTitle
                className="flex items-center gap-2"
                data-oid="icz.id."
              >
                <FileText
                  className="w-5 h-5 text-ink-gold"
                  data-oid="2rw9ah4"
                />
                Planning Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" data-oid="zgzinfn">
              {event.approach_notes && (
                <div data-oid="kumdph6">
                  <h4
                    className="text-sm font-medium text-wood-dark mb-1"
                    data-oid=".y:.z49"
                  >
                    Approach
                  </h4>
                  <p
                    className="text-sm text-sepia whitespace-pre-wrap"
                    data-oid="4c.-sul"
                  >
                    {event.approach_notes}
                  </p>
                </div>
              )}
              {event.marketing_notes && (
                <div data-oid="nrpyngy">
                  <h4
                    className="text-sm font-medium text-wood-dark mb-1"
                    data-oid=":0oyjv2"
                  >
                    Marketing
                  </h4>
                  <p
                    className="text-sm text-sepia whitespace-pre-wrap"
                    data-oid="exa2wcl"
                  >
                    {event.marketing_notes}
                  </p>
                </div>
              )}
              {event.sales_notes && (
                <div data-oid="fd-ghzg">
                  <h4
                    className="text-sm font-medium text-wood-dark mb-1"
                    data-oid="i7ekru2"
                  >
                    Sales
                  </h4>
                  <p
                    className="text-sm text-sepia whitespace-pre-wrap"
                    data-oid="rxh_rj6"
                  >
                    {event.sales_notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card data-oid="4hd8b98">
          <CardHeader data-oid="0qgybsm">
            <CardTitle className="text-sm" data-oid="nktb13y">
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm" data-oid="crp6e5f">
            <div className="flex justify-between" data-oid="8rgqk:s">
              <span className="text-sepia" data-oid="f05qyyu">
                Event ID
              </span>
              <span
                className="font-mono text-xs text-wood-dark"
                data-oid="o_yq58p"
              >
                {event.id}
              </span>
            </div>
            <div className="flex justify-between" data-oid="fysbj-t">
              <span className="text-sepia" data-oid="2edhrb3">
                Fiscal Year
              </span>
              <span className="text-wood-dark" data-oid="m7hh.bo">
                2026
              </span>
            </div>
            <div className="flex justify-between" data-oid="2b163pj">
              <span className="text-sepia" data-oid="kbrdqjk">
                Created
              </span>
              <span className="text-wood-dark" data-oid=":t0m6:k">
                {new Date(event.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between" data-oid="2rd-uk7">
              <span className="text-sepia" data-oid="o913ty0">
                Last Updated
              </span>
              <span className="text-wood-dark" data-oid="hm90o7l">
                {new Date(event.updated_at).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
