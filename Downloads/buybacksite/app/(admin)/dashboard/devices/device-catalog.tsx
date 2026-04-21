"use client";

import { useState, useTransition } from "react";

interface Model {
  id: string;
  name: string;
  slug: string;
  releaseYear: number | null;
  _count: { variants: number };
}

interface Brand {
  id: string;
  name: string;
  models: Model[];
}

interface Category {
  id: string;
  name: string;
  brands: Brand[];
}

interface Props {
  categories: Category[];
  disabledModelIds: string[];
  tenantId: string | null;
  isPlatformAdmin: boolean;
}

export function DeviceCatalog({ categories, disabledModelIds, tenantId, isPlatformAdmin }: Props) {
  const [disabled, setDisabled] = useState(new Set(disabledModelIds));
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const toggleBrand = (brandId: string) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId); else next.add(brandId);
      return next;
    });
  };

  const toggleModel = async (modelId: string) => {
    if (!tenantId || isPlatformAdmin) return;
    const nowActive = disabled.has(modelId);

    setDisabled((prev) => {
      const next = new Set(prev);
      if (nowActive) next.delete(modelId); else next.add(modelId);
      return next;
    });

    startTransition(async () => {
      await fetch("/api/devices/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, active: nowActive }),
      });
    });
  };

  const totalModels = categories.flatMap((c) => c.brands.flatMap((b) => b.models)).length;
  const enabledCount = totalModels - disabled.size;

  return (
    <div>
      {!isPlatformAdmin && tenantId && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          {enabledCount} of {totalModels} models enabled for your wizard.
        </div>
      )}

      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">{cat.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {cat.brands.length} brand{cat.brands.length !== 1 ? "s" : ""} ·{" "}
                {cat.brands.reduce((n, b) => n + b.models.length, 0)} models
              </p>
            </div>

            <div className="divide-y divide-gray-50">
              {cat.brands.map((brand) => (
                <div key={brand.id}>
                  <button
                    onClick={() => toggleBrand(brand.id)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-800">{brand.name}</span>
                      <span className="text-xs text-gray-400">{brand.models.length} models</span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedBrands.has(brand.id) ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expandedBrands.has(brand.id) && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {brand.models.map((model) => {
                        const isActive = !disabled.has(model.id);
                        return (
                          <div key={model.id} className="flex items-center justify-between px-5 py-2.5 pl-10 bg-white">
                            <div>
                              <span className="text-sm text-gray-700">{model.name}</span>
                              {model.releaseYear && (
                                <span className="ml-2 text-xs text-gray-400">{model.releaseYear}</span>
                              )}
                              <span className="ml-2 text-xs text-gray-400">{model._count.variants} variants</span>
                            </div>

                            {!isPlatformAdmin && tenantId && (
                              <button
                                onClick={() => toggleModel(model.id)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  isActive ? "bg-blue-600" : "bg-gray-200"
                                }`}
                                title={isActive ? "Disable" : "Enable"}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                    isActive ? "translate-x-4" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            )}
                            {isPlatformAdmin && (
                              <span className="text-xs text-green-600 font-medium">Active</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
