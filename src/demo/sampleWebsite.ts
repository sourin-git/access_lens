import "./sampleWebsite.css";

export type SampleWebsiteOptions = {
  document?: Document;
  onAction?: (action: "reserve" | "save") => void;
};

/** Mount one instance per document: stable IDs connect findings to sample elements. */
export function createSampleWebsite(options: SampleWebsiteOptions = {}): HTMLElement {
  const doc = options.document ?? document;
  const root = doc.createElement("article");
  root.className = "sample-site";
  root.id = "sample-website";
  root.setAttribute("aria-label", "Orbit Studio sample website");
  root.innerHTML = `
    <a class="sample-skip" href="#sample-main">Skip to sample content</a>
    <header class="sample-header">
      <a class="sample-brand" href="#sample-main" aria-label="Orbit Studio home">ORBIT<span aria-hidden="true">®</span></a>
      <nav id="sample-navigation" aria-label="Sample website">
        <a href="#sample-workshops">Workshops</a>
        <a href="#sample-about">Our space</a>
        <a href="#sample-visit">Plan a visit</a>
      </nav>
    </header>
    <main id="sample-main" tabindex="-1">
      <section class="sample-hero" aria-labelledby="sample-title">
        <p class="sample-eyebrow">A SPACE FOR CURIOUS MINDS</p>
        <h1 id="sample-title">Make room<br>for a new idea.</h1>
        <p id="sample-intro" class="sample-intro">Hands-on workshops, thoughtful tools, and a welcoming community. Find a little inspiration and make something that feels like you.</p>
        <a class="sample-button sample-primary" href="#sample-workshops">Explore workshops <span aria-hidden="true">↗</span></a>
        <p id="sample-low-contrast" class="sample-muted">Small groups. Big possibilities. Everyone welcome.</p>
        <span class="sample-orbit" aria-hidden="true">✳</span>
      </section>
      <section id="sample-workshops" aria-labelledby="sample-workshops-title">
        <div class="sample-section-heading"><h2 id="sample-workshops-title">Find your next spark</h2><span>01 / UPCOMING</span></div>
        <div class="sample-cards">
          <article class="sample-card">
            <div class="sample-art sample-art-blue" aria-hidden="true"><span>◒</span></div>
            <p class="sample-eyebrow">DESIGN · 90 MINUTES</p>
            <h3>Shape &amp; possibility</h3>
            <p>Explore playful forms and turn everyday materials into something unexpected.</p>
            <div class="sample-card-actions"><button id="sample-reserve" type="button" class="sample-primary">Reserve a spot</button>
              <button id="sample-unnamed-save" type="button" class="sample-icon"><span aria-hidden="true">♡</span></button></div>
          </article>
          <article class="sample-card">
            <div class="sample-art sample-art-lime" aria-hidden="true"><span>✺</span></div>
            <p class="sample-eyebrow">COMMUNITY · DROP IN</p>
            <h3>The open studio</h3>
            <p>Bring an unfinished idea, meet a collaborator, or simply see what happens.</p>
            <a class="sample-button" href="#sample-visit">Visit the studio</a>
          </article>
        </div>
      </section>
      <section id="sample-about" class="sample-about" aria-labelledby="sample-about-title">
        <h2 id="sample-about-title">Space to try. Space to belong.</h2>
        <p>Our ground-floor studio has step-free entry, adjustable worktables, and a quiet corner. Contact the team if you would like to discuss access needs.</p>
        <details><summary>What should I bring?</summary><p>Just yourself and your curiosity. Materials are provided, and you can take breaks whenever you need.</p></details>
      </section>
      <section id="sample-visit" aria-labelledby="sample-visit-title">
        <h4 id="sample-visit-title">Come say hello</h4>
        <p>Tuesday–Saturday, 10:00–18:00 · 24 Example Lane (fictional demo location)</p>
        <a href="mailto:hello@example.com">Email the studio</a>
      </section>
      <p id="sample-action-status" class="sample-status" role="status" aria-live="polite" aria-atomic="true"></p>
    </main>
    <footer><p>Orbit Studio · AccessLens demonstration</p><p>This sample intentionally includes a low-contrast sentence, an unnamed save button, and a skipped heading level for the automated scan.</p></footer>
  `;
  const announce = (action: "reserve" | "save", message: string): void => {
    root.querySelector<HTMLElement>("#sample-action-status")!.textContent = message;
    options.onAction?.(action);
  };
  root.querySelector("#sample-reserve")!.addEventListener("click", () => announce("reserve", "Demo reservation selected. No booking or payment has been made."));
  root.querySelector("#sample-unnamed-save")!.addEventListener("click", () => announce("save", "Workshop saved for this demonstration."));
  return root;
}
