(() => {
  const url = new URL(window.location.href);
  const tbm = url.searchParams.get("tbm");
  const udm = url.searchParams.get("udm");

  // Extension runs only on "All" tab:
  const isAllTab = !tbm && (!udm || udm === "7");

  if (!isAllTab) {
    console.log("❌ Not on the 'All' tab – extension script will not run.");
    return;
  }

  console.log("✅ SkipScroll script injected - DOM fix v14 (cancel on scroll/click with user-initiated detection, settings integration)");

  (() => {
    let currentIndex = -1;
    let enterPressed = false;
    let isProgrammaticScroll = false;
    let autoSelect = true;
    let useArrowKeys = true;
    // Default custom key bindings.
    let customKeys = { next: "j", prev: "k", open: "Enter" };

    // Retrieve initial settings.
    chrome.storage.sync.get(
      { autoSelect: false, arrowKeys: true, customKeys: { next: "j", prev: "k", open: "Enter" } },
      (result) => {
        autoSelect = result.autoSelect;
        useArrowKeys = result.arrowKeys;
        customKeys = result.customKeys;
        console.log("Initial settings loaded:", result);
      }
    );

    // Listen for storage changes so that keybind updates are live.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync") {
        if (changes.arrowKeys) {
          useArrowKeys = changes.arrowKeys.newValue;
          console.log("Arrow keys setting updated:", useArrowKeys);
        }
        if (changes.customKeys) {
          customKeys = changes.customKeys.newValue;
          console.log("Custom keys updated:", customKeys);
        }
      }
    });

    function injectStyle() {
      const style = document.createElement('style');
      style.textContent = `
        body.keyboard-nav-active a:focus {
          outline: 3px solid blue !important;
          border-radius: 4px;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }
    if (document.head) {
      injectStyle();
    } else {
      document.addEventListener("DOMContentLoaded", injectStyle);
    }

    const isInRHS = (elem) => !!elem.closest('#rhs');
    const isVisible = (elem) => {
      const rect = elem.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const getResults = () => {
      let h3Elements = document.querySelectorAll('#search div.g a > h3');
      if (h3Elements.length === 0) {
        console.log("No results found with '#search div.g a > h3'; trying fallback '#search a > h3'");
        h3Elements = document.querySelectorAll('#search a > h3');
      }
      console.log("getResults: Found", h3Elements.length, "h3 elements");
      let anchors = Array.from(h3Elements).map(h3 => h3.parentElement);
      anchors = anchors.filter(a => !isInRHS(a) && isVisible(a));
      console.log("getResults: Filtered to", anchors.length, "visible main-column results");
      return anchors;
    };

    // Custom smooth scroll function with snappy easing.
    function smoothScrollTo(targetY, duration = 200) {
      const startY = window.scrollY;
      const difference = targetY - startY;
      const startTime = performance.now();

      function animateScroll(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startY + difference * ease);
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      }
      requestAnimationFrame(animateScroll);
    }

    // Focus a result and optionally scroll to center it.
    const focusResult = (index, doScroll = true) => {
      const results = getResults();
      if (results.length === 0) {
        console.log("❌ focusResult: No valid results found");
        return;
      }
      index = Math.max(0, Math.min(index, results.length - 1));
      currentIndex = index;
      const result = results[currentIndex];
      console.log(`🔍 Focusing result ${currentIndex + 1} of ${results.length}`);
      isProgrammaticScroll = true;
      result.focus({ preventScroll: true });
      if (doScroll) {
        const rect = result.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const targetY = Math.max(0, window.scrollY + elementCenter - window.innerHeight / 2);
        smoothScrollTo(targetY, 200);
      }
      setTimeout(() => { isProgrammaticScroll = false; }, 300);
    };

    const waitForResults = setInterval(() => {
      const results = getResults();
      if (results.length > 0) {
        if (autoSelect && currentIndex === -1) {
          document.body.classList.add("keyboard-nav-active");
          focusResult(0, false);
        }
        if (enterPressed) {
          console.log("⏳ Enter was pressed earlier; triggering click on the focused result");
          results[currentIndex].click();
          enterPressed = false;
        }
        clearInterval(waitForResults);
      }
    }, 100);

    // Returns true when the user is actively typing into an editable field,
    // in which case we must never swallow their keystrokes.
    const isTypingTarget = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      // The Google search box (name="q") is treated as navigable, not typing.
      if (tag === "INPUT") return el.name !== "q";
      if (tag === "TEXTAREA") return true;
      return el.isContentEditable;
    };

    // Locate a generic "Show more" / "See more" toggle button (e.g. the AI
    // Overview expander) anywhere on the page. Prefers semantic ARIA hooks and
    // falls back to visible button text so it keeps working across layouts.
    const findShowMoreButton = () => {
      const labelSelectors = [
        '[role="button"][aria-label*="Show more" i]',
        '[role="button"][aria-label*="See more" i]',
        'button[aria-label*="Show more" i]',
        'button[aria-label*="See more" i]'
      ];
      for (const sel of labelSelectors) {
        const candidates = Array.from(document.querySelectorAll(sel)).filter(isVisible);
        if (candidates.length) return candidates[0];
      }
      // Fallback: match visible button-like elements by their text content.
      const textRe = /^(show|see)\s+more$/i;
      const buttons = document.querySelectorAll('[role="button"], button');
      for (const btn of buttons) {
        if (!isVisible(btn)) continue;
        const text = (btn.textContent || "").trim();
        if (textRe.test(text)) return btn;
      }
      return null;
    };

    // Simulate a real user click on the toggle so its native handler runs,
    // expanding (or collapsing) the AI Overview just like clicking it would.
    const toggleShowMore = (btn) => {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      btn.focus({ preventScroll: true });
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
        btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
    };

    // Pressing "M" acts exactly like clicking the "Show more" button: it toggles
    // the AI Overview open/closed. Runs in the capture phase so it beats any of
    // Google's own page-level key handlers.
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget()) return;
      if (e.key.toLowerCase() !== "m") return;
      const btn = findShowMoreButton();
      if (!btn) {
        console.log('ℹ️ "M" pressed but no "Show more" button was found on the page.');
        return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
      const expanded = btn.getAttribute("aria-expanded");
      console.log(`📖 "M" pressed; toggling "Show more" (was aria-expanded=${expanded})`);
      toggleShowMore(btn);
    }, true);

    // Use custom keys and, if enabled, arrow keys as alternatives.
    document.addEventListener("keydown", (e) => {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT") {
        if (document.activeElement.name === "q") {
          document.activeElement.blur();
        } else {
          return;
        }
      }
      if (tag === "TEXTAREA") return;

      if (e.key.toLowerCase() === customKeys.next.toLowerCase() || (useArrowKeys && e.key === "ArrowDown")) {
        e.preventDefault();
        document.body.classList.add("keyboard-nav-active");
        console.log("➡️ Navigating to next result");
        focusResult(currentIndex + 1, true);
      } else if (e.key.toLowerCase() === customKeys.prev.toLowerCase() || (useArrowKeys && e.key === "ArrowUp")) {
        e.preventDefault();
        document.body.classList.add("keyboard-nav-active");
        console.log("⬅️ Navigating to previous result");
        focusResult(currentIndex - 1, true);
      } else if (e.key === customKeys.open) {
        e.preventDefault();
        const results = getResults();
        if (results.length > 0) {
          if (currentIndex === -1) {
            focusResult(0);
          }
          const url = results[currentIndex].href;
          if (e.shiftKey) {
            console.log("⏩ Shift+Enter pressed; opening result in a new window");
            window.open(url, 'newwindow', 'width=800,height=600,noopener,noreferrer');
          } else if (e.ctrlKey || e.metaKey) {
            console.log("⏩ Ctrl/Cmd+Enter pressed; opening result in a new tab");
            window.open(url, '_blank');
          } else {
            console.log("⏩ Enter pressed; navigating to the selected result");
            results[currentIndex].click();
          }
        } else {
          console.log("⏳ Enter pressed but results not ready; will trigger when available");
          enterPressed = true;
        }
      }
    });

    document.addEventListener("click", () => {
      document.body.classList.remove("keyboard-nav-active");
      setTimeout(() => {
        const results = getResults();
        if (!results.includes(document.activeElement)) {
          console.log("🛑 Focus lost; resetting navigation index");
          currentIndex = -1;
        }
      }, 10);
    });

    const resultsContainer = document.querySelector('#search');
    if (resultsContainer) {
      const observer = new MutationObserver((mutationsList, observer) => {
        const results = getResults();
        if (results.length > 0 && currentIndex !== -1) {
          if (document.activeElement !== results[currentIndex]) {
            console.log("🔄 DOM change detected; reapplying focus to current result");
            focusResult(currentIndex, false);
          }
        }
      });
      observer.observe(resultsContainer, { childList: true, subtree: true });
    } else {
      console.log("No #search container found for MutationObserver");
    }

    window.addEventListener("load", () => {
      console.log("🔔 Window load event fired; reapplying focus continuously for 2 seconds unless user scrolls or clicks.");
      let elapsed = 0;
      const intervalTime = 100;
      let userInteracted = false;

      const onScroll = (e) => {
        if (isProgrammaticScroll) return;
        userInteracted = true;
        console.log("🛑 User scrolled; cancelling focus reapplication.");
        clearInterval(reapplyInterval);
        window.removeEventListener("scroll", onScroll);
      };
      const onClick = () => {
        userInteracted = true;
        console.log("🛑 User clicked; cancelling focus reapplication.");
        clearInterval(reapplyInterval);
        window.removeEventListener("click", onClick);
      };
      window.addEventListener("scroll", onScroll);
      window.addEventListener("click", onClick);

      const reapplyInterval = setInterval(() => {
        if (userInteracted) {
          clearInterval(reapplyInterval);
          return;
        }
        if (currentIndex !== -1) {
          focusResult(currentIndex, false);
        }
        elapsed += intervalTime;
        if (elapsed >= 2000) {
          clearInterval(reapplyInterval);
          console.log("⏹ Stopped continuous reapplication of focus after 2 seconds.");
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("click", onClick);
        }
      }, intervalTime);
    });

    console.log("🚀 SkipScroll (DOM fix v14) loaded: auto-select, enter buffering, reset on blur, reapply focus on DOM changes, cancel on scroll/click with user-initiated detection, settings integration");
  })();
})();
