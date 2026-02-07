"use client";

import { useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  DollarSign,
  Calendar,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { ParsedTransaction } from "./TransactionReview";

/* ============================================
   IMPORT CONFIRMATION COMPONENT
   ============================================
   Summary view before final import.
   Shows what will be imported, skipped, or replaced.
   ============================================ */

interface ImportConfirmationProps {
  transactions: ParsedTransaction[];
  onConfirm: () => void;
  onBack: () => void;
  isLoading?: boolean;
  className?: string;
}

export function ImportConfirmation({
  transactions,
  onConfirm,
  onBack,
  isLoading = false,
  className,
}: ImportConfirmationProps) {
  // Calculate summary
  const summary = useMemo(() => {
    const accepted = transactions.filter((t) => t.status === "accepted");
    const skipped = transactions.filter((t) => t.status === "skipped");
    const replacing = transactions.filter((t) => t.status === "replace");
    const pending = transactions.filter((t) => t.status === "pending");
    const withoutAssignment = accepted.filter((t) => !t.suggestedAssignment);

    const acceptedAmount = accepted.reduce((sum, t) => sum + t.amount, 0);
    const replacingAmount = replacing.reduce((sum, t) => sum + t.amount, 0);

    // Group by assignment
    const byEvent: Record<
      string,
      { name: string; count: number; amount: number }
    > = {};
    const byCategory: Record<
      string,
      { name: string; count: number; amount: number }
    > = {};

    accepted.forEach((t) => {
      if (t.suggestedAssignment) {
        const { id, name, type } = t.suggestedAssignment;
        const target = type === "event" ? byEvent : byCategory;
        if (!target[id]) {
          target[id] = { name, count: 0, amount: 0 };
        }
        target[id].count++;
        target[id].amount += t.amount;
      }
    });

    return {
      accepted,
      skipped,
      replacing,
      pending,
      withoutAssignment,
      acceptedAmount,
      replacingAmount,
      byEvent: Object.values(byEvent),
      byCategory: Object.values(byCategory),
    };
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const canConfirm =
    summary.accepted.length > 0 &&
    summary.withoutAssignment.length === 0 &&
    summary.pending.length === 0;

  return (
    <div className={cn("space-y-6", className)} data-oid="-hs_i:c">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-oid="y948d3g">
        <Card className="bg-ink-green/5 border-ink-green/30" data-oid="mb92pwf">
          <CardContent className="py-4" data-oid="qzxxiet">
            <div className="flex items-center gap-3" data-oid="380av1k">
              <div
                className="p-2 bg-ink-green/20 rounded-lg"
                data-oid="-_-pznp"
              >
                <CheckCircle
                  className="w-5 h-5 text-ink-green"
                  data-oid="4to86y8"
                />
              </div>
              <div data-oid=".h31c3_">
                <p
                  className="text-2xl font-serif font-bold text-ink-green"
                  data-oid="u1ldnul"
                >
                  {summary.accepted.length}
                </p>
                <p className="text-xs text-sepia" data-oid=".a2bmu2">
                  To Import
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ink-gold/5 border-ink-gold/30" data-oid="jry4oz5">
          <CardContent className="py-4" data-oid="slsxofc">
            <div className="flex items-center gap-3" data-oid="cxphk6u">
              <div className="p-2 bg-ink-gold/20 rounded-lg" data-oid="w86b7_t">
                <ArrowRight
                  className="w-5 h-5 text-ink-gold"
                  data-oid="jim3m.l"
                />
              </div>
              <div data-oid="z4-szuw">
                <p
                  className="text-2xl font-serif font-bold text-ink-gold"
                  data-oid="w6xe5fr"
                >
                  {summary.replacing.length}
                </p>
                <p className="text-xs text-sepia" data-oid="h12_1e:">
                  To Replace
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-sepia/5 border-sepia/30" data-oid="sdtobld">
          <CardContent className="py-4" data-oid="rrjo3-w">
            <div className="flex items-center gap-3" data-oid="wujm-xq">
              <div className="p-2 bg-sepia/20 rounded-lg" data-oid="2ok3ibe">
                <XCircle className="w-5 h-5 text-sepia" data-oid="0-9da-7" />
              </div>
              <div data-oid="u2brmap">
                <p
                  className="text-2xl font-serif font-bold text-sepia"
                  data-oid="6c9:clr"
                >
                  {summary.skipped.length}
                </p>
                <p className="text-xs text-sepia" data-oid="mi1iuqu">
                  To Skip
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="bg-wood-medium/5 border-wood-medium/30"
          data-oid="j7t87i5"
        >
          <CardContent className="py-4" data-oid="jqki2:d">
            <div className="flex items-center gap-3" data-oid="z:ij.i5">
              <div
                className="p-2 bg-wood-medium/20 rounded-lg"
                data-oid="t7tkb15"
              >
                <DollarSign
                  className="w-5 h-5 text-wood-medium"
                  data-oid="a9vzez2"
                />
              </div>
              <div data-oid="w_70e78">
                <p
                  className="text-2xl font-serif font-bold text-wood-dark"
                  data-oid="j-9og4g"
                >
                  {formatCurrency(
                    summary.acceptedAmount + summary.replacingAmount,
                  )}
                </p>
                <p className="text-xs text-sepia" data-oid="o0:5t:h">
                  Total Amount
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {summary.withoutAssignment.length > 0 && (
        <div
          className="flex items-start gap-3 p-4 bg-ink-red/10 border border-ink-red/30 rounded-lg"
          data-oid="0rwtgiw"
        >
          <AlertCircle
            className="w-5 h-5 text-ink-red shrink-0 mt-0.5"
            data-oid="n9dbu8g"
          />
          <div data-oid="bo80rk6">
            <p className="font-medium text-ink-red" data-oid="wtldx34">
              Missing Assignments
            </p>
            <p className="text-sm text-ink-red/80 mt-1" data-oid="t5:moq1">
              {summary.withoutAssignment.length} transaction(s) are marked to
              import but have no event or category assigned. Please go back and
              assign them or mark them as skipped.
            </p>
          </div>
        </div>
      )}

      {summary.pending.length > 0 && (
        <div
          className="flex items-start gap-3 p-4 bg-ink-gold/10 border border-ink-gold/30 rounded-lg"
          data-oid="m8ij2fe"
        >
          <AlertCircle
            className="w-5 h-5 text-ink-gold shrink-0 mt-0.5"
            data-oid="hrm:azi"
          />
          <div data-oid=".6dz2am">
            <p className="font-medium text-ink-gold" data-oid="k5lbbip">
              Pending Decisions
            </p>
            <p className="text-sm text-sepia mt-1" data-oid="m1oj9qa">
              {summary.pending.length} transaction(s) still need to be marked as
              accepted, skipped, or replaced. Please go back and make a decision
              for each.
            </p>
          </div>
        </div>
      )}

      {/* Breakdown by Assignment */}
      <div className="grid md:grid-cols-2 gap-6" data-oid="ueqvf:2">
        {/* By Event */}
        {summary.byEvent.length > 0 && (
          <Card data-oid="ibzp9eh">
            <CardHeader divider data-oid="10iysre">
              <CardTitle
                className="flex items-center gap-2 text-base"
                data-oid="c8ap0v7"
              >
                <Calendar
                  className="w-4 h-4 text-ink-gold"
                  data-oid="40gvgm5"
                />
                By Event
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0" data-oid="7k2a1s5">
              <div
                className="divide-y divide-wood-medium/10"
                data-oid=".ufvv_2"
              >
                {summary.byEvent.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3"
                    data-oid="bimeml2"
                  >
                    <div data-oid="jly9_rv">
                      <p
                        className="text-sm font-medium text-ink-black"
                        data-oid=".f0tz49"
                      >
                        {item.name}
                      </p>
                      <p className="text-xs text-sepia" data-oid="a072soy">
                        {item.count} transaction(s)
                      </p>
                    </div>
                    <p
                      className="text-sm font-mono font-medium text-ink-black"
                      data-oid="3uh04sa"
                    >
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* By Category */}
        {summary.byCategory.length > 0 && (
          <Card data-oid="mww32jd">
            <CardHeader divider data-oid="_gbaiu-">
              <CardTitle
                className="flex items-center gap-2 text-base"
                data-oid="f8xd1je"
              >
                <FolderOpen
                  className="w-4 h-4 text-ink-green"
                  data-oid="ugvez6-"
                />
                By Category
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0" data-oid="nv6yrmk">
              <div
                className="divide-y divide-wood-medium/10"
                data-oid="a2vrh2r"
              >
                {summary.byCategory.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3"
                    data-oid="dj6j_re"
                  >
                    <div data-oid="-az6.4d">
                      <p
                        className="text-sm font-medium text-ink-black"
                        data-oid="m1lg99b"
                      >
                        {item.name}
                      </p>
                      <p className="text-xs text-sepia" data-oid="d2y-1ag">
                        {item.count} transaction(s)
                      </p>
                    </div>
                    <p
                      className="text-sm font-mono font-medium text-ink-black"
                      data-oid="ey5jx31"
                    >
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transaction List Preview */}
      {summary.accepted.length > 0 && (
        <Card data-oid="rnvrif8">
          <CardHeader divider data-oid="55f-h-u">
            <CardTitle className="text-base" data-oid="81dv-lp">
              Transactions to Import
            </CardTitle>
          </CardHeader>
          <CardContent
            className="py-0 max-h-64 overflow-y-auto"
            data-oid="z6_fh5-"
          >
            <div className="divide-y divide-wood-medium/10" data-oid="b_bb:tk">
              {summary.accepted.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-3"
                  data-oid="b337qpc"
                >
                  <div className="flex-1 min-w-0" data-oid="6:3ab9e">
                    <p
                      className="text-sm font-medium text-ink-black truncate"
                      data-oid="8aoid04"
                    >
                      {t.vendor}
                    </p>
                    <p className="text-xs text-sepia" data-oid="uk8j30b">
                      {new Date(t.date).toLocaleDateString()} &middot;{" "}
                      {t.suggestedAssignment?.name || "Unassigned"}
                    </p>
                  </div>
                  <p
                    className="text-sm font-mono font-medium text-ink-black ml-4"
                    data-oid="psbroa4"
                  >
                    {formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
              {summary.accepted.length > 10 && (
                <div
                  className="py-3 text-center text-sm text-sepia"
                  data-oid="lc51eyr"
                >
                  ... and {summary.accepted.length - 10} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card data-oid="0.ybo1c">
        <CardFooter
          className="flex items-center justify-between gap-4"
          data-oid="h1cm15f"
        >
          <Button
            variant="secondary"
            onClick={onBack}
            disabled={isLoading}
            data-oid="wpgokmz"
          >
            Back to Review
          </Button>
          <Button
            variant="success"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={!canConfirm || isLoading}
            data-oid="t8jty4j"
          >
            <CheckCircle className="w-4 h-4 mr-2" data-oid="cz7pvci" />
            Confirm Import ({summary.accepted.length +
              summary.replacing.length}{" "}
            items)
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ImportConfirmation;
