// Background service worker for Flux Prompt Optimizer Extension
import { optimizePrompt } from "./src/utils/optimizeEngine.js"

chrome.runtime.onInstalled.addListener(() => {
  console.log("Flux Prompt Optimizer installed")
  // Set default extension settings
  chrome.storage.sync.set({
    optimizationEnabled: true,
    defaultMode: "GENERAL",
    defaultLevel: "MEDIUM",
    keyboardShortcut: "Ctrl+Shift+P"
  })
})

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "optimizePrompt") {
    optimizePrompt(request.text, request.mode, request.level, request.contextProfile)
      .then(optimizedPrompt => {
        sendResponse({ optimizedPrompt })
      })
      .catch(error => {
        console.error("Optimization error:", error)
        sendResponse({ error: error.message })
      })
    return true // Indicates we want to send a response asynchronously
  }

  if (request.action === "getSettings") {
    chrome.storage.sync.get(null, (settings) => {
      sendResponse(settings)
    })
    return true
  }

  if (request.action === "saveSettings") {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true })
    })
    return true
  }
})

// Handle keyboard shortcuts (if implemented via commands in manifest)
// This would be handled differently if using the "commands" key in manifest