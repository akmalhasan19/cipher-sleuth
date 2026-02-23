import { HeroSection } from "./components/hero-section";
import { ReviewsSection } from "./components/reviews-section";
import { TopNavigation } from "./components/top-navigation";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#2d5a45] text-black">
      <div className="brutalist-grid pointer-events-none absolute inset-0" />

      <TopNavigation />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-4 pt-5 md:px-8 md:pb-6">
        <HeroSection />
        <ReviewsSection />

        <footer className="rounded-2xl border-4 border-black bg-white px-5 py-4 shadow-[4px_4px_0_#000] md:shadow-[8px_8px_0_#000]">
          <div className="flex flex-col items-center justify-between gap-3 text-sm font-semibold md:flex-row">
            <div className="flex flex-wrap justify-center gap-4">
              <a href="#" className="underline-offset-4 hover:underline">
                Teams
              </a>
              <a href="#" className="underline-offset-4 hover:underline">
                Docs
              </a>
              <a href="#" className="underline-offset-4 hover:underline">
                Blog
              </a>
              <a href="#" className="underline-offset-4 hover:underline">
                Playbook
              </a>
            </div>
            <p>Cipher Sleuth (c) 2026</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
