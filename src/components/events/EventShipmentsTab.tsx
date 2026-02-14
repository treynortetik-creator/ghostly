'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, RefreshCw, Trash2, Edit3, ExternalLink, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

/* ============================================
   EVENT SHIPMENTS TAB
   ============================================
   Shows event shipments with status badges,
   add shipment form, and soft delete. Includes
   tracking links and status management.
   ============================================ */

interface EventShipment {
  id: string;
  event_id: string;
  description: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  ship_date: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  shipped_from: string | null;
  shipped_to: string | null;
  weight_lbs: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface EventShipmentsTabProps {
  eventId: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  in_transit: { label: 'In Transit', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  delivered: { label: 'Delivered', className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  returned: { label: 'Returned', className: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  issue: { label: 'Issue', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'issue', label: 'Issue' },
];

const carrierOptions = [
  { value: '', label: 'Select carrier...' },
  { value: 'UPS', label: 'UPS' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'USPS', label: 'USPS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'Other', label: 'Other' },
];

function generateTrackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!carrier || !trackingNumber) return null;
  
  switch (carrier.toLowerCase()) {
    case 'ups':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
    case 'dhl':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackingNumber)}`;
    default:
      return null;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function EventShipmentsTab({ eventId }: EventShipmentsTabProps) {
  const [shipments, setShipments] = useState<EventShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingShipment, setEditingShipment] = useState<EventShipment | null>(null);
  const [newShipment, setNewShipment] = useState({
    description: '',
    carrier: '',
    tracking_number: '',
    shipped_from: '',
    shipped_to: '',
    ship_date: '',
    estimated_delivery: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchShipments = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/shipments`);
      if (res.ok) {
        const data = await res.json();
        setShipments(data.shipments || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const handleAddShipment = async () => {
    if (!newShipment.description.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newShipment.description,
          carrier: newShipment.carrier || undefined,
          tracking_number: newShipment.tracking_number || undefined,
          shipped_from: newShipment.shipped_from || undefined,
          shipped_to: newShipment.shipped_to || undefined,
          ship_date: newShipment.ship_date || undefined,
          estimated_delivery: newShipment.estimated_delivery || undefined,
          notes: newShipment.notes || undefined,
          created_by: 'Treynor',
        }),
      });
      if (res.ok) {
        setNewShipment({
          description: '',
          carrier: '',
          tracking_number: '',
          shipped_from: '',
          shipped_to: '',
          ship_date: '',
          estimated_delivery: '',
          notes: '',
        });
        setShowAddForm(false);
        fetchShipments();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (shipment: EventShipment, newStatus: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/shipments/${shipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchShipments();
    } catch { /* ignore */ }
  };

  const handleEditShipment = async (shipment: EventShipment) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/shipments/${shipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: shipment.description,
          carrier: shipment.carrier || undefined,
          tracking_number: shipment.tracking_number || undefined,
          shipped_from: shipment.shipped_from || undefined,
          shipped_to: shipment.shipped_to || undefined,
          ship_date: shipment.ship_date || undefined,
          estimated_delivery: shipment.estimated_delivery || undefined,
          notes: shipment.notes || undefined,
        }),
      });
      if (res.ok) {
        setEditingShipment(null);
        fetchShipments();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (shipmentId: string) => {
    if (!confirm('Delete this shipment?')) return;
    try {
      const res = await fetch(`/api/events/${eventId}/shipments/${shipmentId}`, { method: 'DELETE' });
      if (res.ok) fetchShipments();
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sepia">Loading shipments...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-wood-dark flex items-center gap-2">
          <Package className="w-5 h-5 text-ink-gold" />
          Shipments ({shipments.length})
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchShipments()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Shipment
          </Button>
        </div>
      </div>

      {/* Add Shipment Form */}
      {showAddForm && (
        <Card className="border-ink-gold/30">
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-sepia mb-1 block">Description *</label>
                <input
                  type="text"
                  value={newShipment.description}
                  onChange={(e) => setNewShipment({ ...newShipment, description: e.target.value })}
                  placeholder="What's being shipped..."
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark placeholder:text-sepia/50 focus:border-ink-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-sepia mb-1 block">Carrier</label>
                <select
                  value={newShipment.carrier}
                  onChange={(e) => setNewShipment({ ...newShipment, carrier: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark focus:border-ink-gold focus:outline-none"
                >
                  {carrierOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-sepia mb-1 block">Tracking Number</label>
                <input
                  type="text"
                  value={newShipment.tracking_number}
                  onChange={(e) => setNewShipment({ ...newShipment, tracking_number: e.target.value })}
                  placeholder="1Z999AA1234567890"
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark placeholder:text-sepia/50 focus:border-ink-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-sepia mb-1 block">Shipped From</label>
                <input
                  type="text"
                  value={newShipment.shipped_from}
                  onChange={(e) => setNewShipment({ ...newShipment, shipped_from: e.target.value })}
                  placeholder="Origin location"
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark placeholder:text-sepia/50 focus:border-ink-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-sepia mb-1 block">Shipped To</label>
                <input
                  type="text"
                  value={newShipment.shipped_to}
                  onChange={(e) => setNewShipment({ ...newShipment, shipped_to: e.target.value })}
                  placeholder="Destination location"
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark placeholder:text-sepia/50 focus:border-ink-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-sepia mb-1 block">Ship Date</label>
                <input
                  type="date"
                  value={newShipment.ship_date}
                  onChange={(e) => setNewShipment({ ...newShipment, ship_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark focus:border-ink-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-sepia mb-1 block">Estimated Delivery</label>
                <input
                  type="date"
                  value={newShipment.estimated_delivery}
                  onChange={(e) => setNewShipment({ ...newShipment, estimated_delivery: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark focus:border-ink-gold focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-sepia mb-1 block">Notes</label>
                <textarea
                  value={newShipment.notes}
                  onChange={(e) => setNewShipment({ ...newShipment, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark placeholder:text-sepia/50 focus:border-ink-gold focus:outline-none resize-y"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddShipment} disabled={isSubmitting || !newShipment.description.trim()}>
                {isSubmitting ? 'Saving...' : 'Save Shipment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shipments List */}
      {shipments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sepia">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No shipments yet. Add one to track deliveries for this event.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shipments.map((shipment) => {
            const statusConf = statusConfig[shipment.status] || statusConfig.pending;
            const trackingUrl = shipment.tracking_url || generateTrackingUrl(shipment.carrier, shipment.tracking_number);

            return (
              <Card key={shipment.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Header row: status badge + tracking link */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${statusConf.className}`}>
                          {statusConf.label}
                        </span>
                        {trackingUrl && (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-ink-gold hover:text-ink-gold/80 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Track
                          </a>
                        )}
                        {shipment.carrier && (
                          <span className="inline-flex items-center gap-1 text-xs text-sepia">
                            <Truck className="w-3 h-3" />
                            {shipment.carrier}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm font-medium text-wood-dark mb-1">{shipment.description}</p>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-sepia">
                        {shipment.shipped_from && (
                          <div><span className="font-medium">From:</span> {shipment.shipped_from}</div>
                        )}
                        {shipment.shipped_to && (
                          <div><span className="font-medium">To:</span> {shipment.shipped_to}</div>
                        )}
                        {shipment.ship_date && (
                          <div><span className="font-medium">Shipped:</span> {formatDate(shipment.ship_date)}</div>
                        )}
                        {shipment.estimated_delivery && (
                          <div><span className="font-medium">Est. Delivery:</span> {formatDate(shipment.estimated_delivery)}</div>
                        )}
                        {shipment.tracking_number && (
                          <div className="col-span-2"><span className="font-medium">Tracking:</span> {shipment.tracking_number}</div>
                        )}
                      </div>

                      {/* Notes */}
                      {shipment.notes && (
                        <p className="text-xs text-sepia mt-2 whitespace-pre-wrap">{shipment.notes}</p>
                      )}

                      {/* Footer: created by + date */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-sepia">
                        <span className="font-medium">{shipment.created_by}</span>
                        <span>·</span>
                        <span>{formatDate(shipment.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <select
                        value={shipment.status}
                        onChange={(e) => handleUpdateStatus(shipment, e.target.value)}
                        className="text-xs px-2 py-1 bg-parchment-dark border border-wood-medium/30 rounded text-wood-dark focus:border-ink-gold focus:outline-none"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDelete(shipment.id)}
                        className="p-1.5 text-sepia hover:text-ink-red transition-colors"
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