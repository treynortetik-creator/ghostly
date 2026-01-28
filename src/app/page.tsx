import { AppShell } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  BudgetProgress,
  Button,
} from '@/components/ui';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Plus,
  ArrowRight,
} from 'lucide-react';

// Demo data - will be replaced with real data from Supabase
const demoStats = {
  totalBudget: 1095200,
  totalSpent: 287450,
  eventsCount: 43,
  overBudgetCount: 2,
};

const demoCategoryBudgets = [
  { name: 'Executive Events', spent: 125000, budget: 339200 },
  { name: 'National Events', spent: 98500, budget: 264400 },
  { name: 'State Events', spent: 45200, budget: 116100 },
  { name: 'Customer Events', spent: 18750, budget: 150000 },
];

const demoRecentExpenses = [
  { vendor: 'NIC Conference Center', amount: 12500, date: '2026-01-27', event: 'NIC Spring Conference' },
  { vendor: 'American Seniors Housing Association', amount: 2400, date: '2026-01-25', event: 'ASHA Annual Meeting' },
  { vendor: 'Marriott Hotels', amount: 8900, date: '2026-01-24', event: 'Healthtac East' },
];

export default function DashboardPage() {
  const remaining = demoStats.totalBudget - demoStats.totalSpent;
  const percentUsed = (demoStats.totalSpent / demoStats.totalBudget) * 100;

  return (
    <AppShell>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-wood-dark">
          The Ledger
        </h1>
        <p className="mt-1 text-sepia">
          FY 2026 Budget Overview &middot; As of January 28, 2026
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        <StatCard
          title="Total Budget"
          value={demoStats.totalBudget.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          })}
          subtitle="FY 2026 allocation"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Total Spent"
          value={demoStats.totalSpent.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          })}
          subtitle={`${percentUsed.toFixed(1)}% of budget used`}
          trend={percentUsed > 80 ? 'negative' : 'positive'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Remaining"
          value={remaining.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          })}
          subtitle={`${(100 - percentUsed).toFixed(1)}% available`}
          trend="positive"
          icon={<Calendar className="w-5 h-5" />}
        />
        <StatCard
          title="Alerts"
          value={demoStats.overBudgetCount}
          subtitle="Events over budget"
          trend={demoStats.overBudgetCount > 0 ? 'negative' : 'neutral'}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget by Category */}
        <div className="lg:col-span-2">
          <Card flourish>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Budget by Event Type</CardTitle>
                  <CardDescription>
                    Spending breakdown across event categories
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {demoCategoryBudgets.map((category) => (
                <BudgetProgress
                  key={category.name}
                  label={category.name}
                  spent={category.spent}
                  budget={category.budget}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Expenses */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Expenses</CardTitle>
                  <CardDescription>Latest recorded transactions</CardDescription>
                </div>
                <Button variant="gold" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoRecentExpenses.map((expense, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between py-3 border-b border-wood-medium/15 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-black text-sm truncate">
                      {expense.vendor}
                    </p>
                    <p className="text-xs text-sepia truncate">
                      {expense.event}
                    </p>
                    <p className="text-xs text-sepia/70 mt-0.5">
                      {new Date(expense.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="font-medium text-ink-black tabular-nums ml-3">
                    {expense.amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0,
                    })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <Card className="bg-gradient-to-r from-wood-dark to-wood-medium">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="font-serif text-xl text-parchment font-semibold">
                  Import Expenses
                </h3>
                <p className="text-parchment/70 text-sm mt-1">
                  Upload Brex CSV or PDF invoices to automatically categorize expenses
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary">
                  Upload CSV
                </Button>
                <Button variant="gold">
                  Upload PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
