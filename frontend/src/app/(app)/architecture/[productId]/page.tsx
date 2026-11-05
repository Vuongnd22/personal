"use client";

import { use } from "react";
import { ArchitectureCanvas } from "@/components/architecture/canvas";

export default function ArchitectureEditorPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  return (
    <div className="h-full bg-white">
      <ArchitectureCanvas productId={productId} />
    </div>
  );
}
