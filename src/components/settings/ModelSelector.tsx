"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  ChevronDown,
  Check,
  AlertCircle,
  DollarSign,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { OpenRouterModel } from "@/lib/openrouter";

/* ============================================
   MODEL SELECTOR COMPONENT
   ============================================
   Dropdown to select the AI model for transaction
   categorization. Shows pricing and capabilities.
   Victorian theme: "The Mechanical Oracle"
   ============================================ */

interface ModelSelectorProps {
  /** Currently selected model ID */
  value: string;
  /** Callback when model selection changes */
  onChange: (modelId: string) => void;
  /** Disable the selector */
  disabled?: boolean;
}

// Recommended models for categorization tasks
const recommendedModels = [
  "anthropic/claude-3-haiku",
  "anthropic/claude-3-5-haiku",
  "openai/gpt-4o-mini",
  "google/gemini-flash-1.5",
];

export function ModelSelector({
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "recommended">("recommended");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch models
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/openrouter/models");
        if (!response.ok) throw new Error("Failed to fetch models");
        const data = await response.json();
        setModels(data.models);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load models");
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Get selected model
  const selectedModel = models.find((m) => m.id === value);

  // Filter models
  const filteredModels = models.filter((model) => {
    const matchesSearch = searchQuery
      ? model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    const matchesFilter =
      filter === "all"
        ? true
        : recommendedModels.some(
            (rec) => model.id.startsWith(rec) || model.id === rec,
          );

    return matchesSearch && matchesFilter;
  });

  // Format price for display
  const formatPrice = (price: string): string => {
    const num = parseFloat(price);
    if (num >= 0.01) return `$${num.toFixed(3)}`;
    if (num >= 0.001) return `$${num.toFixed(4)}`;
    return `$${num.toFixed(6)}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".model-selector")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Card className="model-selector" data-oid="o.8b5j2">
      <CardHeader divider={false} className="pb-2" data-oid="l4n9pb.">
        <CardTitle
          className="text-lg flex items-center gap-2"
          data-oid="7otjv-y"
        >
          <Bot className="w-5 h-5 text-ink-gold" data-oid="anvr9t." />
          AI Model
        </CardTitle>
        <p className="text-sm text-sepia mt-1" data-oid="8_f57g.">
          Select the model for automatic transaction categorization
        </p>
      </CardHeader>

      <CardContent data-oid="dsh-0vg">
        {/* Dropdown Trigger */}
        <div className="relative" data-oid="lnxfgi4">
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled || isLoading}
            className={`
              w-full flex items-center justify-between px-4 py-3
              bg-parchment border border-wood-medium/40 rounded-md
              text-wood-dark font-medium
              transition-all duration-200
              ${
                disabled || isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-wood-medium cursor-pointer"
              }
              ${isOpen ? "border-ink-gold ring-1 ring-ink-gold/30" : ""}
            `}
            data-oid="nhscnm9"
          >
            <span
              className="flex items-center gap-2 flex-1 min-w-0"
              data-oid="cnwnxzm"
            >
              {isLoading ? (
                <span className="text-sepia" data-oid="wa47vl4">
                  Loading models...
                </span>
              ) : selectedModel ? (
                <span className="truncate" data-oid=":blosv8">
                  {selectedModel.name || selectedModel.id}
                </span>
              ) : value ? (
                <span className="truncate" data-oid="-g8zvb0">
                  {value}
                </span>
              ) : (
                <span className="text-sepia" data-oid="vhvie9.">
                  Select a model
                </span>
              )}
            </span>
            <ChevronDown
              className={`w-5 h-5 text-sepia flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
              data-oid="lbd5.u-"
            />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 z-10
              bg-parchment border border-wood-medium/40 rounded-md shadow-lg"
              data-oid="5udoe-p"
            >
              {/* Search & Filter */}
              <div
                className="p-3 border-b border-wood-medium/20 space-y-2"
                data-oid="-ogo2yz"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/40
                    rounded text-sm text-wood-dark
                    focus:outline-none focus:ring-1 focus:ring-ink-gold"
                  data-oid="ek017e6"
                />

                <div className="flex gap-2" data-oid=".q70aj2">
                  <button
                    type="button"
                    onClick={() => setFilter("recommended")}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      filter === "recommended"
                        ? "bg-ink-gold text-ink-black"
                        : "bg-wood-medium/20 text-sepia hover:bg-wood-medium/30"
                    }`}
                    data-oid="dcl45vc"
                  >
                    Recommended
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      filter === "all"
                        ? "bg-ink-gold text-ink-black"
                        : "bg-wood-medium/20 text-sepia hover:bg-wood-medium/30"
                    }`}
                    data-oid="cd7is:k"
                  >
                    All Models
                  </button>
                </div>
              </div>

              {/* Model Options */}
              <div className="max-h-64 overflow-y-auto" data-oid="tjoi3-5">
                {filteredModels.length === 0 ? (
                  <div
                    className="px-4 py-6 text-center text-sepia"
                    data-oid="bqaqvgy"
                  >
                    No models found
                  </div>
                ) : (
                  filteredModels.map((model) => {
                    const isRecommended = recommendedModels.some(
                      (rec) => model.id.startsWith(rec) || model.id === rec,
                    );

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          onChange(model.id);
                          setIsOpen(false);
                        }}
                        className={`
                          w-full flex flex-col px-4 py-3 text-left transition-colors
                          ${
                            model.id === value
                              ? "bg-ink-gold/10"
                              : "hover:bg-wood-medium/10"
                          }
                        `}
                        data-oid="dgg9rs:"
                      >
                        <div
                          className="flex items-center justify-between"
                          data-oid="5e3-ric"
                        >
                          <span
                            className="font-medium text-wood-dark flex items-center gap-2"
                            data-oid="i26ef9c"
                          >
                            {model.name || model.id}
                            {isRecommended && (
                              <Zap
                                className="w-3 h-3 text-ink-gold"
                                data-oid="oc0dfua"
                              />
                            )}
                          </span>
                          {model.id === value && (
                            <Check
                              className="w-4 h-4 text-ink-gold flex-shrink-0"
                              data-oid="ysm9v46"
                            />
                          )}
                        </div>
                        <div
                          className="flex items-center gap-3 mt-1 text-xs text-sepia"
                          data-oid="4rd4zf."
                        >
                          <span
                            className="flex items-center gap-1"
                            data-oid="o1zhyt-"
                          >
                            <DollarSign
                              className="w-3 h-3"
                              data-oid="l6tm6:d"
                            />
                            {formatPrice(model.pricing.prompt)}/1K tokens
                          </span>
                          <span className="text-sepia/50" data-oid="oj9q2-u">
                            |
                          </span>
                          <span data-oid="z11vvj9">
                            {(model.context_length / 1000).toFixed(0)}K context
                          </span>
                        </div>
                        {model.description && (
                          <p
                            className="text-xs text-sepia/70 mt-1 line-clamp-1"
                            data-oid="oc:qzp8"
                          >
                            {model.description}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="mt-2 flex items-center gap-2 text-sm text-ink-red"
            data-oid="s80:3x5"
          >
            <AlertCircle className="w-4 h-4" data-oid="xzqnz4k" />
            <span data-oid="1:p4amg">{error}</span>
          </div>
        )}

        {/* Selected Model Info */}
        {selectedModel && !isOpen && (
          <div
            className="mt-3 p-3 bg-wood-medium/5 rounded border border-wood-medium/20"
            data-oid="9ruzrkq"
          >
            <div
              className="flex items-center justify-between text-sm"
              data-oid="o75ubml"
            >
              <span className="text-sepia" data-oid="6snl_4g">
                Model ID:
              </span>
              <code
                className="text-wood-dark font-mono text-xs bg-parchment-dark px-2 py-0.5 rounded"
                data-oid="gpo9jqa"
              >
                {selectedModel.id}
              </code>
            </div>
            <div
              className="flex items-center justify-between text-sm mt-2"
              data-oid="i5j914e"
            >
              <span className="text-sepia" data-oid="zd19v4i">
                Cost per 1K input tokens:
              </span>
              <span className="text-wood-dark" data-oid="v8.q1tz">
                {formatPrice(selectedModel.pricing.prompt)}
              </span>
            </div>
            <div
              className="flex items-center justify-between text-sm mt-1"
              data-oid="v488e6t"
            >
              <span className="text-sepia" data-oid="zrwn5kl">
                Cost per 1K output tokens:
              </span>
              <span className="text-wood-dark" data-oid="60f8tnv">
                {formatPrice(selectedModel.pricing.completion)}
              </span>
            </div>
          </div>
        )}

        {/* Help Text */}
        <p className="mt-3 text-xs text-sepia/70" data-oid="5dmjv9w">
          Recommended models offer the best balance of speed, accuracy, and cost
          for categorization tasks.
        </p>
      </CardContent>
    </Card>
  );
}

export default ModelSelector;
