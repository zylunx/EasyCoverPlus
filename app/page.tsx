import Controls from "@/components/cover/Controls";
import Canvas from "@/components/cover/Canvas";

export default function Home() {
  return (
    <main className="flex flex-col-reverse md:flex-row h-[100dvh] w-full bg-background overflow-hidden">
      <Controls />
      <Canvas />
    </main>
  );
}
