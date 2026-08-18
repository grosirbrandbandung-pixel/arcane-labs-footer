import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const TerraWave = lazy(() => import("@/components/TerraWave"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Terra Wave — WebGL Wireframe Terrain Animation" },
      {
        name: "description",
        content:
          "An animated WebGL wireframe terrain that ripples toward a glowing horizon under a field of stars.",
      },
      { property: "og:title", content: "Terra Wave — WebGL Wireframe Terrain Animation" },
      {
        property: "og:description",
        content: "Animated WebGL wireframe terrain waves with a glowing horizon and starfield.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <h1 className="sr-only">Terra Wave WebGL animation</h1>
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <TerraWave />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
