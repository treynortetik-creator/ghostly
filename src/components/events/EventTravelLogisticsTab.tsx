'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Car,
  FileText,
  Hotel,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDateMedium } from '@/lib/format';

interface TravelEntry {
  id: string;
  event_id: string;
  team_member_id: string | null;
  traveler_name: string;
  traveler_email: string | null;
  traveler_role: string | null;
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_check_in: string | null;
  hotel_check_out: string | null;
  hotel_confirmation_number: string | null;
  flight_airline: string | null;
  flight_number: string | null;
  flight_departure_airport: string | null;
  flight_arrival_airport: string | null;
  flight_departure_at: string | null;
  flight_arrival_at: string | null;
  flight_confirmation_number: string | null;
  ground_transport_mode: string | null;
  ground_transport_details: string | null;
  lodging_budget: number | null;
  airfare_budget: number | null;
  ground_transport_budget: number | null;
  meals_budget: number | null;
  misc_travel_budget: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface TeamMemberOption {
  id: string;
  name: string;
  email: string | null;
  default_role: string | null;
  event_role: string | null;
}

interface TravelTotals {
  lodging_budget: number;
  airfare_budget: number;
  ground_transport_budget: number;
  meals_budget: number;
  misc_travel_budget: number;
  total_budget: number;
}

interface EventTravelLogisticsTabProps {
  eventId: string;
}

interface TravelFormData {
  team_member_id: string;
  traveler_name: string;
  traveler_email: string;
  traveler_role: string;
  hotel_name: string;
  hotel_address: string;
  hotel_check_in: string;
  hotel_check_out: string;
  hotel_confirmation_number: string;
  flight_airline: string;
  flight_number: string;
  flight_departure_airport: string;
  flight_arrival_airport: string;
  flight_departure_at: string;
  flight_arrival_at: string;
  flight_confirmation_number: string;
  ground_transport_mode: string;
  ground_transport_details: string;
  lodging_budget: string;
  airfare_budget: string;
  ground_transport_budget: string;
  meals_budget: string;
  misc_travel_budget: string;
  notes: string;
}

const groundTransportOptions = [
  { value: '', label: 'Select transport mode...' },
  { value: 'rental_car', label: 'Rental Car' },
  { value: 'shuttle', label: 'Shuttle' },
  { value: 'rideshare', label: 'Rideshare' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'public_transit', label: 'Public Transit' },
  { value: 'other', label: 'Other' },
];

function buildEmptyForm(): TravelFormData {
  return {
    team_member_id: '',
    traveler_name: '',
    traveler_email: '',
    traveler_role: '',
    hotel_name: '',
    hotel_address: '',
    hotel_check_in: '',
    hotel_check_out: '',
    hotel_confirmation_number: '',
    flight_airline: '',
    flight_number: '',
    flight_departure_airport: '',
    flight_arrival_airport: '',
    flight_departure_at: '',
    flight_arrival_at: '',
    flight_confirmation_number: '',
    ground_transport_mode: '',
    ground_transport_details: '',
    lodging_budget: '',
    airfare_budget: '',
    ground_transport_budget: '',
    meals_budget: '',
    misc_travel_budget: '',
    notes: '',
  };
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function parseBudget(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed) || parsed < 0) return undefined;
  return parsed;
}

export function EventTravelLogisticsTab({ eventId }: EventTravelLogisticsTabProps) {
  const [entries, setEntries] = useState<TravelEntry[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [totals, setTotals] = useState<TravelTotals>({
    lodging_budget: 0,
    airfare_budget: 0,
    ground_transport_budget: 0,
    meals_budget: 0,
    misc_travel_budget: 0,
    total_budget: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompilingBrief, setIsCompilingBrief] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [brief, setBrief] = useState<string>('');
  const [form, setForm] = useState<TravelFormData>(() => buildEmptyForm());

  const isEditing = editingEntryId !== null;

  const fetchTravelLogistics = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/travel-logistics`);
      if (!response.ok) return;
      const data = await response.json();
      setEntries(data.entries || []);
      setTeamMembers(data.team_members || []);
      setTotals(data.totals || {
        lodging_budget: 0,
        airfare_budget: 0,
        ground_transport_budget: 0,
        meals_budget: 0,
        misc_travel_budget: 0,
        total_budget: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchTravelLogistics();
  }, [fetchTravelLogistics]);

  const resetForm = () => {
    setForm(buildEmptyForm());
    setEditingEntryId(null);
    setShowForm(false);
  };

  const handleTeamMemberSelect = (teamMemberId: string) => {
    const member = teamMembers.find((tm) => tm.id === teamMemberId);
    if (!member) {
      setForm((prev) => ({ ...prev, team_member_id: teamMemberId }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      team_member_id: teamMemberId,
      traveler_name: prev.traveler_name || member.name || '',
      traveler_email: prev.traveler_email || member.email || '',
      traveler_role: prev.traveler_role || member.event_role || member.default_role || '',
    }));
  };

  const populateFormForEdit = (entry: TravelEntry) => {
    setEditingEntryId(entry.id);
    setShowForm(true);
    setForm({
      team_member_id: entry.team_member_id || '',
      traveler_name: entry.traveler_name || '',
      traveler_email: entry.traveler_email || '',
      traveler_role: entry.traveler_role || '',
      hotel_name: entry.hotel_name || '',
      hotel_address: entry.hotel_address || '',
      hotel_check_in: entry.hotel_check_in || '',
      hotel_check_out: entry.hotel_check_out || '',
      hotel_confirmation_number: entry.hotel_confirmation_number || '',
      flight_airline: entry.flight_airline || '',
      flight_number: entry.flight_number || '',
      flight_departure_airport: entry.flight_departure_airport || '',
      flight_arrival_airport: entry.flight_arrival_airport || '',
      flight_departure_at: toDateTimeLocal(entry.flight_departure_at),
      flight_arrival_at: toDateTimeLocal(entry.flight_arrival_at),
      flight_confirmation_number: entry.flight_confirmation_number || '',
      ground_transport_mode: entry.ground_transport_mode || '',
      ground_transport_details: entry.ground_transport_details || '',
      lodging_budget: entry.lodging_budget?.toString() || '',
      airfare_budget: entry.airfare_budget?.toString() || '',
      ground_transport_budget: entry.ground_transport_budget?.toString() || '',
      meals_budget: entry.meals_budget?.toString() || '',
      misc_travel_budget: entry.misc_travel_budget?.toString() || '',
      notes: entry.notes || '',
    });
  };

  const handleSaveEntry = async () => {
    if (!form.traveler_name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        team_member_id: form.team_member_id || undefined,
        traveler_name: form.traveler_name,
        traveler_email: form.traveler_email || undefined,
        traveler_role: form.traveler_role || undefined,
        hotel_name: form.hotel_name || undefined,
        hotel_address: form.hotel_address || undefined,
        hotel_check_in: form.hotel_check_in || undefined,
        hotel_check_out: form.hotel_check_out || undefined,
        hotel_confirmation_number: form.hotel_confirmation_number || undefined,
        flight_airline: form.flight_airline || undefined,
        flight_number: form.flight_number || undefined,
        flight_departure_airport: form.flight_departure_airport || undefined,
        flight_arrival_airport: form.flight_arrival_airport || undefined,
        flight_departure_at: form.flight_departure_at ? new Date(form.flight_departure_at).toISOString() : undefined,
        flight_arrival_at: form.flight_arrival_at ? new Date(form.flight_arrival_at).toISOString() : undefined,
        flight_confirmation_number: form.flight_confirmation_number || undefined,
        ground_transport_mode: form.ground_transport_mode || undefined,
        ground_transport_details: form.ground_transport_details || undefined,
        lodging_budget: parseBudget(form.lodging_budget),
        airfare_budget: parseBudget(form.airfare_budget),
        ground_transport_budget: parseBudget(form.ground_transport_budget),
        meals_budget: parseBudget(form.meals_budget),
        misc_travel_budget: parseBudget(form.misc_travel_budget),
        notes: form.notes || undefined,
        created_by: 'Treynor',
      };

      const url = isEditing
        ? `/api/events/${eventId}/travel-logistics/${editingEntryId}`
        : `/api/events/${eventId}/travel-logistics`;

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        resetForm();
        await fetchTravelLogistics();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setDeleteConfirmId(null);
    await fetch(`/api/events/${eventId}/travel-logistics/${entryId}`, { method: 'DELETE' });
    await fetchTravelLogistics();
  };

  const handleCompileBrief = async () => {
    setIsCompilingBrief(true);
    try {
      const response = await fetch(`/api/events/${eventId}/travel-logistics/brief`);
      if (!response.ok) return;
      const data = await response.json();
      setBrief(data.brief || '');
    } finally {
      setIsCompilingBrief(false);
    }
  };

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.traveler_name.localeCompare(b.traveler_name)),
    [entries]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading travel logistics...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete Travel Entry"
        message="Delete this travel logistics entry?"
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteConfirmId) handleDeleteEntry(deleteConfirmId); }}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Plane className="w-5 h-5 text-spectral" />
          Travel &amp; Logistics ({entries.length})
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchTravelLogistics()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleCompileBrief} disabled={isCompilingBrief}>
            <FileText className="w-4 h-4 mr-1" />
            {isCompilingBrief ? 'Compiling...' : 'Compile Brief'}
          </Button>
          <Button size="sm" onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}>
            <Plus className="w-4 h-4 mr-1" />
            {showForm ? 'Close' : 'Add Travel Entry'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Travel Budget Categories</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Lodging</p>
            <p className="font-semibold text-foreground">{formatCurrency(totals.lodging_budget || 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Airfare</p>
            <p className="font-semibold text-foreground">{formatCurrency(totals.airfare_budget || 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ground</p>
            <p className="font-semibold text-foreground">{formatCurrency(totals.ground_transport_budget || 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Meals</p>
            <p className="font-semibold text-foreground">{formatCurrency(totals.meals_budget || 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Misc</p>
            <p className="font-semibold text-foreground">{formatCurrency(totals.misc_travel_budget || 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Travel</p>
            <p className="font-semibold text-spectral">{formatCurrency(totals.total_budget || 0)}</p>
          </div>
        </CardContent>
      </Card>

      {brief && (
        <Card className="border-spectral">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Compiled Logistics Brief</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">{brief}</pre>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="border-spectral">
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Team Member (optional)</label>
                <select
                  value={form.team_member_id}
                  onChange={(e) => handleTeamMemberSelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground focus:border-spectral focus:outline-none"
                >
                  <option value="">Select assigned team member...</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Traveler Name *</label>
                <input
                  type="text"
                  value={form.traveler_name}
                  onChange={(e) => setForm({ ...form, traveler_name: e.target.value })}
                  placeholder="Team member name"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Traveler Email</label>
                <input
                  type="email"
                  value={form.traveler_email}
                  onChange={(e) => setForm({ ...form, traveler_email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                <input
                  type="text"
                  value={form.traveler_role}
                  onChange={(e) => setForm({ ...form, traveler_role: e.target.value })}
                  placeholder="Field Marketing, Sales, etc."
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                  <Hotel className="w-3.5 h-3.5" />
                  Hotel
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hotel Name</label>
                <input
                  type="text"
                  value={form.hotel_name}
                  onChange={(e) => setForm({ ...form, hotel_name: e.target.value })}
                  placeholder="Hotel property"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirmation #</label>
                <input
                  type="text"
                  value={form.hotel_confirmation_number}
                  onChange={(e) => setForm({ ...form, hotel_confirmation_number: e.target.value })}
                  placeholder="Hotel confirmation number"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Check In</label>
                <input
                  type="date"
                  value={form.hotel_check_in}
                  onChange={(e) => setForm({ ...form, hotel_check_in: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Check Out</label>
                <input
                  type="date"
                  value={form.hotel_check_out}
                  onChange={(e) => setForm({ ...form, hotel_check_out: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground focus:border-spectral focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                  <Plane className="w-3.5 h-3.5" />
                  Flight
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Airline</label>
                <input
                  type="text"
                  value={form.flight_airline}
                  onChange={(e) => setForm({ ...form, flight_airline: e.target.value })}
                  placeholder="Delta, United, etc."
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Flight Number</label>
                <input
                  type="text"
                  value={form.flight_number}
                  onChange={(e) => setForm({ ...form, flight_number: e.target.value })}
                  placeholder="DL 472"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Departure Airport</label>
                <input
                  type="text"
                  value={form.flight_departure_airport}
                  onChange={(e) => setForm({ ...form, flight_departure_airport: e.target.value })}
                  placeholder="PHX"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Arrival Airport</label>
                <input
                  type="text"
                  value={form.flight_arrival_airport}
                  onChange={(e) => setForm({ ...form, flight_arrival_airport: e.target.value })}
                  placeholder="LAS"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Departure Time</label>
                <input
                  type="datetime-local"
                  value={form.flight_departure_at}
                  onChange={(e) => setForm({ ...form, flight_departure_at: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Arrival Time</label>
                <input
                  type="datetime-local"
                  value={form.flight_arrival_at}
                  onChange={(e) => setForm({ ...form, flight_arrival_at: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground focus:border-spectral focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Flight Confirmation #</label>
                <input
                  type="text"
                  value={form.flight_confirmation_number}
                  onChange={(e) => setForm({ ...form, flight_confirmation_number: e.target.value })}
                  placeholder="Airline confirmation number"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5" />
                  Ground Transport
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Transport Mode</label>
                <select
                  value={form.ground_transport_mode}
                  onChange={(e) => setForm({ ...form, ground_transport_mode: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground focus:border-spectral focus:outline-none"
                >
                  {groundTransportOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Transport Details</label>
                <input
                  type="text"
                  value={form.ground_transport_details}
                  onChange={(e) => setForm({ ...form, ground_transport_details: e.target.value })}
                  placeholder="Vendor, pickup notes, etc."
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Travel Expense Categories (Separate from Event Expenses)
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Lodging Budget</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.lodging_budget}
                  onChange={(e) => setForm({ ...form, lodging_budget: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Airfare Budget</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.airfare_budget}
                  onChange={(e) => setForm({ ...form, airfare_budget: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Ground Transport Budget</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ground_transport_budget}
                  onChange={(e) => setForm({ ...form, ground_transport_budget: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Meals Budget</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.meals_budget}
                  onChange={(e) => setForm({ ...form, meals_budget: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Misc Travel Budget</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.misc_travel_budget}
                  onChange={(e) => setForm({ ...form, misc_travel_budget: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Extra travel notes, check-in instructions, etc."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none resize-y"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEntry} disabled={isSubmitting || !form.traveler_name.trim()}>
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Entry' : 'Save Entry'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sortedEntries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Plane className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No travel logistics entries yet. Add one for each team member attending.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedEntries.map((entry) => {
            const travelerBudget = Number(entry.lodging_budget || 0)
              + Number(entry.airfare_budget || 0)
              + Number(entry.ground_transport_budget || 0)
              + Number(entry.meals_budget || 0)
              + Number(entry.misc_travel_budget || 0);

            return (
              <Card key={entry.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border bg-spectral/10 text-spectral border-spectral/30">
                          <UserRound className="w-3 h-3 mr-1" />
                          {entry.traveler_name}
                        </span>
                        {entry.traveler_role && (
                          <span className="text-xs text-muted-foreground">{entry.traveler_role}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Hotel:</span>{' '}
                          {entry.hotel_name || 'TBD'}
                          {entry.hotel_confirmation_number ? ` (${entry.hotel_confirmation_number})` : ''}
                        </div>
                        <div>
                          <span className="font-medium">Flight:</span>{' '}
                          {(entry.flight_airline || entry.flight_number)
                            ? `${entry.flight_airline || ''} ${entry.flight_number || ''}`.trim()
                            : 'TBD'}
                          {entry.flight_confirmation_number ? ` (${entry.flight_confirmation_number})` : ''}
                        </div>
                        <div>
                          <span className="font-medium">Ground:</span>{' '}
                          {entry.ground_transport_mode ? entry.ground_transport_mode.replace(/_/g, ' ') : 'TBD'}
                        </div>
                        <div>
                          <span className="font-medium">Travel Budget:</span>{' '}
                          {formatCurrency(travelerBudget)}
                        </div>
                        {(entry.hotel_check_in || entry.hotel_check_out) && (
                          <div>
                            <span className="font-medium">Stay:</span>{' '}
                            {entry.hotel_check_in ? formatDateMedium(entry.hotel_check_in) : 'TBD'} - {entry.hotel_check_out ? formatDateMedium(entry.hotel_check_out) : 'TBD'}
                          </div>
                        )}
                        {(entry.flight_departure_airport || entry.flight_arrival_airport) && (
                          <div>
                            <span className="font-medium">Route:</span>{' '}
                            {entry.flight_departure_airport || 'TBD'} - {entry.flight_arrival_airport || 'TBD'}
                          </div>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{entry.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => populateFormForEdit(entry)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(entry.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
