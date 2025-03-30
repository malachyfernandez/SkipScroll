console.log("✅ Google Search Navigator script injected - DOM fix v7 (Skip right-hand panel; skip invisible anchors)");

(() => {
  let currentIndex = -1;

  // Inject visual focus styling (no yellow background)
  const style = document.createElement('style');
  style.textContent = `
    a:focus {
      outline: 3px solid blue !important;
      border-radius: 4px;
    }
  `;
  document.head.appendChild(style);

  // Returns true if the element is in the right-hand side (knowledge panel, etc.).
  const isInRHS = (elem) => {
    return !!elem.closest('#rhs');
  };

  // Returns true if the element has a nonzero bounding box (i.e., is visible).
  const isVisible = (elem) => {
    const rect = elem.getBoundingClientRect();
    return (rect.width > 0 && rect.height > 0);
  };

  // Gather potential organic results. Filter out those in #rhs or invisible.
  const getResults = () => {
    // First try "div.g a>h3" within #search:
    let h3Elements = document.querySelectorAll('#search div.g a > h3');
    if (h3Elements.length === 0) {
      console.log("No results found with '#search div.g a > h3'; trying fallback '#search a > h3'");
      h3Elements = document.querySelectorAll('#search a > h3');
    }
    console.log("getResults: Found", h3Elements.length, "h3 elements");

    // Convert NodeList to array, map each <h3> to its parent anchor <a>.
    let anchors = Array.from(h3Elements).map(h3 => h3.parentElement);

    // Filter out anchors that are in #rhs or have 0 bounding box.
    anchors = anchors.filter(a => !isInRHS(a) && isVisible(a));

    console.log("getResults: Filtered to", anchors.length, "visible main-column results");
    return anchors;
  };

  const focusResult = (index) => {
    const results = getResults();
    if (results.length === 0) {
      console.log("❌ focusResult: No valid results found");
      return;
    }

    // Clamp the index within bounds.
    index = Math.max(0, Math.min(index, results.length - 1));
    currentIndex = index;

    const result = results[currentIndex];
    console.log(`🔍 Focusing result ${currentIndex + 1} of ${results.length}`);
    console.log("📦 Result HTML:", result.outerHTML);
    result.focus();
    result.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Listen for keydown events to navigate results
  document.addEventListener("keydown", (e) => {
    console.log("🔑 Key pressed:", e.key);

    // If the focused element is an input (like the search box), blur it so we can navigate.
    const tag = document.activeElement.tagName;
    if (tag === "INPUT") {
      if (document.activeElement.name === "q") {
        document.activeElement.blur();
      } else {
        return;
      }
    }
    if (tag === "TEXTAREA") return;

    if (e.key.toLowerCase() === "j") {
      e.preventDefault();
      console.log("➡️ Navigating to next result");
      focusResult(currentIndex + 1);
    } else if (e.key.toLowerCase() === "k") {
      e.preventDefault();
      console.log("⬅️ Navigating to previous result");
      focusResult(currentIndex - 1);
    }
  });

  console.log("🚀 Google Search Navigator (DOM fix v7) loaded: skip #rhs & invisible anchors");
})();
