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

    chrome.storage.sync.get({ autoSelect: true }, (result) => {
      autoSelect = result.autoSelect;
      console.log("AutoSelect setting loaded:", autoSelect);
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

    // Custom smooth scroll function with a snappier (shorter) duration.
    function smoothScrollTo(targetY, duration = 200) {
      const startY = window.scrollY;
      const difference = targetY - startY;
      const startTime = performance.now();

      function animateScroll(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Cubic ease-out: fast at the start, snappy finish.
        const ease = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startY + difference * ease);
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      }
      requestAnimationFrame(animateScroll);
    }

    // Focus the result; always prevent the default scroll then animate if desired.
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
      // Always prevent the browser's default scrolling.
      result.focus({ preventScroll: true });
      if (doScroll) {
        // Calculate the position to center the element in the viewport.
        const rect = result.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const targetY = window.scrollY + elementCenter - window.innerHeight / 2;
        smoothScrollTo(targetY, 200);
      }
      setTimeout(() => { isProgrammaticScroll = false; }, 300);
    };

    const waitForResults = setInterval(() => {
      const results = getResults();
      if (results.length > 0) {
        if (autoSelect && currentIndex === -1) {
          document.body.classList.add("keyboard-nav-active");
          focusResult(0, false);  // focus without scrolling on page load
        }
        if (enterPressed) {
          console.log("⏳ Enter was pressed earlier; triggering click on the focused result");
          results[currentIndex].click();
          enterPressed = false;
        }
        clearInterval(waitForResults);
      }
    }, 100);

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

      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        document.body.classList.add("keyboard-nav-active");
        console.log("➡️ Navigating to next result");
        focusResult(currentIndex + 1, true); // always animate scroll for j/k
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.body.classList.add("keyboard-nav-active");
        console.log("⬅️ Navigating to previous result");
        focusResult(currentIndex - 1, true);
      } else if (e.key === "Enter") {
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
            focusResult(currentIndex, false); // reapply focus without scrolling
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
          focusResult(currentIndex, false); // focus without scrolling on reapplication
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
