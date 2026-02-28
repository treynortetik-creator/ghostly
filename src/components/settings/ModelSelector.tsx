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
   Ghostly theme: "The Mechanical Oracle"
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
    <Card className="model-selector">
      <CardHeader divider={false} className="pb-2">
        <CardTitle
          className="text-lg flex items-center gap-2"
         
        >
          <Bot className="w-5 h-5 text-spectral" />
          AI Model
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Select the model for automatic transaction categorization
        </p>
      </CardHeader>

      <CardContent>
        {/* Dropdown Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled || isLoading}
            className={`
              w-full flex items-center justify-between px-4 py-3
              bg-background border border-border rounded-md
              text-foreground font-medium
              transition-all duration-200
              ${
                disabled || isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-border cursor-pointer"
              }
              ${isOpen ? "border-spectral ring-1 ring-spectral/30" : ""}
            `}
           
          >
            <span
              className="flex items-center gap-2 flex-1 min-w-0"
             
            >
              {isLoading ? (
                <span className="text-muted-foreground">
                  Loading models...
                </span>
              ) : selectedModel ? (
                <span className="truncate">
                  {selectedModel.name || selectedModel.id}
                </span>
              ) : value ? (
                <span className="truncate">
                  {value}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Select a model
                </span>
              )}
            </span>
            <ChevronDown
              className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
             
            />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 z-10
              bg-background border border-border rounded-md shadow-lg"
             
            >
              {/* Search & Filter */}
              <div
                className="p-3 border-b border-border space-y-2"
               
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className="w-full px-3 py-2 bg-card border border-border
                    rounded text-sm text-foreground
                    focus:outline-none focus:ring-1 focus:ring-spectral"
                 
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFilter("recommended")}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      filter === "recommended"
                        ? "bg-spectral text-foreground"
                        : "bg-spectral/10 text-muted-foreground hover:bg-spectral/10"
                    }`}
                   
                  >
                    Recommended
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      filter === "all"
                        ? "bg-spectral text-foreground"
                        : "bg-spectral/10 text-muted-foreground hover:bg-spectral/10"
                    }`}
                   
                  >
                    All Models
                  </button>
                </div>
              </div>

              {/* Model Options */}
              <div className="max-h-64 overflow-y-auto">
                {filteredModels.length === 0 ? (
                  <div
                    className="px-4 py-6 text-center text-muted-foreground"
                   
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
                              ? "bg-spectral/10"
                              : "hover:bg-spectral/10"
                          }
                        `}
                       
                      >
                        <div
                          className="flex items-center justify-between"
                         
                        >
                          <span
                            className="font-medium text-foreground flex items-center gap-2"
                           
                          >
                            {model.name || model.id}
                            {isRecommended && (
                              <Zap
                                className="w-3 h-3 text-spectral"
                               
                              />
                            )}
                          </span>
                          {model.id === value && (
                            <Check
                              className="w-4 h-4 text-spectral flex-shrink-0"
                             
                            />
                          )}
                        </div>
                        <div
                          className="flex items-center gap-3 mt-1 text-xs text-muted-foreground"
                         
                        >
                          <span
                            className="flex items-center gap-1"
                           
                          >
                            <DollarSign
                              className="w-3 h-3"
                             
                            />
                            {formatPrice(model.pricing.prompt)}/1K tokens
                          </span>
                          <span className="text-muted-foreground/60">
                            |
                          </span>
                          <span>
                            {(model.context_length / 1000).toFixed(0)}K context
                          </span>
                        </div>
                        {model.description && (
                          <p
                            className="text-xs text-muted-foreground/60 mt-1 line-clamp-1"
                           
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
            className="mt-2 flex items-center gap-2 text-sm text-destructive"
           
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Selected Model Info */}
        {selectedModel && !isOpen && (
          <div
            className="mt-3 p-3 bg-spectral/10 rounded border border-border"
           
          >
            <div
              className="flex items-center justify-between text-sm"
             
            >
              <span className="text-muted-foreground">
                Model ID:
              </span>
              <code
                className="text-foreground font-mono text-xs bg-card px-2 py-0.5 rounded"
               
              >
                {selectedModel.id}
              </code>
            </div>
            <div
              className="flex items-center justify-between text-sm mt-2"
             
            >
              <span className="text-muted-foreground">
                Cost per 1K input tokens:
              </span>
              <span className="text-foreground">
                {formatPrice(selectedModel.pricing.prompt)}
              </span>
            </div>
            <div
              className="flex items-center justify-between text-sm mt-1"
             
            >
              <span className="text-muted-foreground">
                Cost per 1K output tokens:
              </span>
              <span className="text-foreground">
                {formatPrice(selectedModel.pricing.completion)}
              </span>
            </div>
          </div>
        )}

        {/* Help Text */}
        <p className="mt-3 text-xs text-muted-foreground/60">
          Recommended models offer the best balance of speed, accuracy, and cost
          for categorization tasks.
        </p>
      </CardContent>
    </Card>
  );
}

export default ModelSelector;
