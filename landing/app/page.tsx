import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import TemplateShowcase from "@/components/TemplateShowcase";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-neutral-950">
      <Nav />
      <Hero />
      <Features />
      <TemplateShowcase />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
