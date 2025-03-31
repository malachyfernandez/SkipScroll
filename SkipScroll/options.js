document.addEventListener("DOMContentLoaded", () => {
  // Dismiss button handling.
  const dismissButton = document.querySelector(".dismiss-button");
  if (dismissButton) {
    dismissButton.addEventListener("click", () => {
      const pointer = document.getElementById("settingsPointer");
      pointer.classList.add("dismissing");
      pointer.addEventListener("transitionend", () => {
        pointer.remove();
      });
    });
  }

  const autoSelectCheckbox = document.getElementById("autoSelectCheckbox");
  const githubLink = document.getElementById("github-link");

  // Load autoSelect setting from storage.
  chrome.storage.sync.get({ autoSelect: false }, (result) => {
    autoSelectCheckbox.checked = result.autoSelect;
  });

  autoSelectCheckbox.addEventListener("change", () => {
    const autoSelect = autoSelectCheckbox.checked;
    chrome.storage.sync.set({ autoSelect }, () => {
      console.log("Auto-select setting updated to", autoSelect);
    });
  });

  githubLink.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: githubLink.href });
  });

  // Update static key displays for OS differences.
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const keyElements = document.querySelectorAll(".shortcut-key");
  keyElements.forEach((key) => {
    if (key.textContent.trim() === "Ctrl") {
      key.textContent = isMac ? "Cmd" : "Ctrl";
    }
  });

  // Keyboard Settings Section elements.
  const arrowKeysCheckbox = document.getElementById("arrowKeysCheckbox");
  const customizeKeysButton = document.getElementById("customize-keys-button");
  const prevKeyDisplay = document.getElementById("prevKeyDisplay");
  const nextKeyDisplay = document.getElementById("nextKeyDisplay");
  const openKeyDisplay = document.getElementById("openKeyDisplay");
  const customizeModal = document.getElementById("customizeModal");
  const modalClose = document.getElementById("modalClose");

  // Temporary object to hold custom keys while the modal is open.
  let tempCustomKeys = { next: "j", prev: "k", open: "Enter" };

  // Function to update arrow key icons and "or" text.
  function updateArrowKeyIcons(enabled) {
    const arrowKeysElements = document.querySelectorAll(".arrow-key");
    arrowKeysElements.forEach(el => {
      el.style.display = enabled ? "inline-block" : "none";
    });
    const arrowOrElements = document.querySelectorAll(".arrow-or");
    arrowOrElements.forEach(el => {
      el.style.display = enabled ? "inline-block" : "none";
    });
  }

  // Function to update the static shortcut displays in the options panel.
  function updateOptionsShortcuts() {
    chrome.storage.sync.get({ customKeys: { next: "j", prev: "k", open: "Enter" } }, (result) => {
      const customKeys = result.customKeys;
      document.querySelectorAll('.shortcut-key[data-key="prev"]').forEach(el => {
        el.textContent = customKeys.prev;
      });
      document.querySelectorAll('.shortcut-key[data-key="next"]').forEach(el => {
        el.textContent = customKeys.next;
      });
      document.querySelectorAll('.shortcut-key[data-key="open"]').forEach(el => {
        el.textContent = customKeys.open;
      });
    });
  }

  // Load arrowKeys and customKeys settings.
  chrome.storage.sync.get(
    { arrowKeys: true, customKeys: { next: "j", prev: "k", open: "Enter" } },
    (result) => {
      arrowKeysCheckbox.checked = result.arrowKeys;
      // Initialize temporary keys with current settings.
      tempCustomKeys = Object.assign({}, result.customKeys);
      prevKeyDisplay.textContent = result.customKeys.prev;
      nextKeyDisplay.textContent = result.customKeys.next;
      openKeyDisplay.textContent = result.customKeys.open;
      updateArrowKeyIcons(result.arrowKeys);
      updateOptionsShortcuts();
    }
  );

  arrowKeysCheckbox.addEventListener("change", () => {
    const arrowKeys = arrowKeysCheckbox.checked;
    chrome.storage.sync.set({ arrowKeys }, () => {
      console.log("Arrow keys setting updated to", arrowKeys);
      updateArrowKeyIcons(arrowKeys);
      updateOptionsShortcuts();
    });
  });

  // Open modal for customizing keys.
  customizeKeysButton.addEventListener("click", () => {
    // Reinitialize temporary keys when opening the modal.
    chrome.storage.sync.get({ customKeys: { next: "j", prev: "k", open: "Enter" } }, (result) => {
      tempCustomKeys = Object.assign({}, result.customKeys);
      prevKeyDisplay.textContent = tempCustomKeys.prev;
      nextKeyDisplay.textContent = tempCustomKeys.next;
      openKeyDisplay.textContent = tempCustomKeys.open;
      customizeModal.style.display = "block";
    });
  });

  // When modal is closed (via close button or clicking outside), update storage.
  function closeModalAndUpdate() {
    customizeModal.style.display = "none";
    chrome.storage.sync.set({ customKeys: tempCustomKeys }, () => {
      console.log("Custom keys updated:", tempCustomKeys);
      updateOptionsShortcuts();
    });
  }

  modalClose.addEventListener("click", () => {
    closeModalAndUpdate();
  });

  window.addEventListener("click", (event) => {
    if (event.target === customizeModal) {
      closeModalAndUpdate();
    }
  });

  // Attach key change listener to a key display element.
  function attachKeyChangeListener(element, keyType) {
    element.addEventListener("click", () => {
      element.textContent = "Press any key";
      function onKeyDown(e) {
        e.preventDefault();
        const newKey = e.key;
        element.textContent = newKey;
        // Update the temporary keys object.
        tempCustomKeys[keyType] = newKey;
        window.removeEventListener("keydown", onKeyDown);
      }
      window.addEventListener("keydown", onKeyDown);
    });
  }

  // Attach listeners to key display elements.
  attachKeyChangeListener(prevKeyDisplay, "prev");
  attachKeyChangeListener(nextKeyDisplay, "next");
  attachKeyChangeListener(openKeyDisplay, "open");
});
