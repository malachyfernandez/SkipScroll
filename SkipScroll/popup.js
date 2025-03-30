document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('autoSelectCheckbox');
  const githubLink = document.getElementById('github-link');

  // Load current setting from storage; default is true.
  chrome.storage.sync.get({ autoSelect: true }, (result) => {
    checkbox.checked = result.autoSelect;
  });

  // Update storage when the checkbox is toggled.
  checkbox.addEventListener('change', () => {
    const autoSelect = checkbox.checked;
    chrome.storage.sync.set({ autoSelect }, () => {
      console.log('Auto-select setting updated to', autoSelect);
    });
  });

  // Handle the GitHub link click
  githubLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent the default link behavior
    chrome.tabs.create({ url: githubLink.href });
  });
  
  // Update keyboard shortcut display based on the OS.
  // If on a Mac, replace "Ctrl" with "CMD"; otherwise, display "Control".
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const keyElements = document.querySelectorAll('.shortcut-key');
  keyElements.forEach((key) => {
    if (key.textContent.trim() === 'Ctrl') {
      key.textContent = isMac ? 'Cmd' : 'Ctrl';
    }
  });
});
