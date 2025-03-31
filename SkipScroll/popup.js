document.addEventListener("DOMContentLoaded", () => {
  // Add dismiss event listener if .dismiss-button exists.
  const dismissButton = document.querySelector(".dismiss-button");
  if (dismissButton) {
    dismissButton.addEventListener("click", () => {
      const pointer = document.getElementById("settingsPointer");
      pointer.classList.add("dismissing");
      console.log("hello");
      pointer.addEventListener("transitionend", function () {
        pointer.remove();
      });
    });
  }

  const checkbox = document.getElementById("autoSelectCheckbox");
  const settingsButton = document.getElementById("settings-button");

  // Load autoSelect setting.
  chrome.storage.sync.get({ autoSelect: false }, (result) => {
    if (checkbox) checkbox.checked = result.autoSelect;
  });

  if (checkbox) {
    checkbox.addEventListener("change", () => {
      const autoSelect = checkbox.checked;
      chrome.storage.sync.set({ autoSelect }, () => {
        console.log("Auto-select setting updated to", autoSelect);
      });
    });
  }

  // Settings button opens the options page.
  if (settingsButton) {
    settingsButton.addEventListener("click", (event) => {
      event.preventDefault();
      const optionsUrl = chrome.runtime.getURL("options.html");
      chrome.tabs.create({ url: optionsUrl });
    });
  }

  // Function to update popup shortcut display.
  function updatePopupShortcuts() {
    chrome.storage.sync.get({ customKeys: { next: "j", prev: "k", open: "Enter" }, arrowKeys: true }, (result) => {
      const customKeys = result.customKeys;
      const arrowEnabled = result.arrowKeys;
      const keyElements = document.querySelectorAll(".shortcut-key");
      keyElements.forEach((key) => {
        const text = key.textContent.trim();
        // Update key texts for previous, next, and open.
        if (text.toLowerCase() === "k" || text === customKeys.prev) {
          key.textContent = customKeys.prev;
        } else if (text.toLowerCase() === "j" || text === customKeys.next) {
          key.textContent = customKeys.next;
        } else if (text === "Enter" || text === customKeys.open) {
          key.textContent = customKeys.open;
        }
      });
      // Toggle arrow icon display.
      const arrowElements = document.querySelectorAll(".arrow-key, .arrow-or");
      arrowElements.forEach(el => {
        el.style.display = arrowEnabled ? "inline-block" : "none";
      });
    });
  }

  // Initial update.
  updatePopupShortcuts();

  // Listen for storage changes to update popup in real time.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.customKeys || changes.arrowKeys)) {
      updatePopupShortcuts();
    }
  });

  // Update static keys based on OS.
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const ctrlElements = document.querySelectorAll(".shortcut-key");
  ctrlElements.forEach((key) => {
    if (key.textContent.trim() === "Ctrl") {
      key.textContent = isMac ? "Cmd" : "Ctrl";
    }
  });
});
