// Content script for Flux Prompt Optimizer Extension
// Detects AI chat platforms and injects Optimize button

class FluxOptimizer {
  constructor() {
    this.settings = null
    this.optimizeButton = null
    this.textareaSelector = this.detectTextarea()
    this.initialize()
  }

  async initialize() {
    // Load settings from storage
    this.settings = await this.getSettings()

    if (!this.settings.optimizationEnabled) return

    // Observe DOM changes to detect when textarea appears
    this.observeDOM()

    // Check if textarea already exists
    this.attachToTextarea()
  }

  detectTextarea() {
    // Map of known AI platforms to their textarea selectors
    const selectors = {
      "chatgpt.com": "textarea[id='prompt-textarea'], textarea[data-id='root']",
      "gemini.google.com": "textarea[aria-label='Talk to Gemini']",
      "claude.ai": "textarea[aria-label='Ask Claude']",
      "perplexity.ai": "textarea[placeholder='Ask anything...']",
      "grok.com": "textarea[placeholder='Ask Grok']",
      "deepseek.com": "textarea[placeholder='Ask DeepSeek']"
    }

    const hostname = window.location.hostname
    for (const [domain, selector] of Object.entries(selectors)) {
      if (hostname.includes(domain)) {
        return selector
      }
    }

    // Default fallback
    return "textarea"
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (settings) => {
        resolve({
          optimizationEnabled: settings.optimizationEnabled ?? true,
          defaultMode: settings.defaultMode ?? "GENERAL",
          defaultLevel: settings.defaultLevel ?? "MEDIUM",
          keyboardShortcut: settings.keyboardShortcut ?? "Ctrl+Shift+P"
        })
      })
    })
  }

  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          this.attachToTextarea()
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  attachToTextarea() {
    // Remove existing button if any
    this.removeOptimizeButton()

    const textarea = document.querySelector(this.textareaSelector)
    if (!textarea) return

    // Check if we've already attached to this textarea
    if (textarea.dataset.fluxAttached) return

    this.createOptimizeButton(textarea)
    textarea.dataset.fluxAttached = "true"
  }

  createOptimizeButton(textarea) {
    // Create button container
    const container = document.createElement("div")
    container.style.position = "relative"
    container.style.display = "inline-block"
    container.style.marginLeft = "8px"

    // Create the optimize button
    this.optimizeButton = document.createElement("button")
    this.optimizeButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4L12 20M4 12L20 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 16.5L16.5 16M17.5 14.5L18 14M18.5 11.5L19 11M19 7.5L19.5 7M18.5 4L19 3.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Optimize</span>
    `
    this.optimizeButton.style.display = "flex"
    this.optimizeButton.style.alignItems = "center"
    this.optimizeButton.style.gap = "6px"
    this.optimizeButton.style.padding = "6px 12px"
    this.optimizeButton.style.backgroundColor = "rgba(0, 0, 0, 0.6)"
    this.optimizeButton.style.color = "white"
    this.optimizeButton.style.border = "none"
    this.optimizeButton.style.borderRadius = "6px"
    this.optimizeButton.style.cursor = "pointer"
    this.optimizeButton.style.fontSize = "14px"
    this.optimizeButton.style.fontWeight = "500"
    this.optimizeButton.style.transition = "all 0.2s ease"
    this.optimizeButton.style.zIndex = "10000"
    this.optimizeButton.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)"

    // Hover effects
    this.optimizeButton.addEventListener("mouseenter", () => {
      this.optimizeButton.style.backgroundColor = "rgba(0, 0, 0, 0.8)"
      this.optimizeButton.style.transform = "translateY(-2px)"
    })

    this.optimizeButton.addEventListener("mouseleave", () => {
      this.optimizeButton.style.backgroundColor = "rgba(0, 0, 0, 0.6)"
      this.optimizeButton.style.transform = "translateY(0)"
    })

    // Click handler
    this.optimizeButton.addEventListener("click", async () => {
      await this.handleOptimizeClick(textarea)
    })

    // Position the button next to the textarea
    // For simplicity, we'll insert it after the textarea
    // In a more sophisticated implementation, we'd position it absolutely
    textarea.parentNode.insertBefore(container, textarea.nextSibling)
    container.appendChild(this.optimizeButton)
  }

  async handleOptimizeClick(textarea) {
    // Disable button during optimization
    const originalText = this.optimizeButton.innerHTML
    this.optimizeButton.disabled = true
    this.optimizeButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.2"/>
        <path d="M12 6v5l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Optimizing...</span>
    `

    try {
      const originalValue = textarea.value
      const selectionStart = textarea.selectionStart
      const selectionEnd = textarea.selectionEnd

      // Get context from storage (simplified)
      const contextProfile = await this.getContextProfile()

      // Send message to background to optimize
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "optimizePrompt",
            text: originalValue,
            mode: this.settings.defaultMode,
            level: this.settings.defaultLevel,
            contextProfile: contextProfile
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve(response)
            }
          }
        )
      })

      if (response.error) {
        throw new Error(response.error)
      }

      // Replace textarea content
      textarea.value = response.optimizedPrompt

      // Trigger input event to notify frameworks like React
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
      textarea.dispatchEvent(new Event("change", { bubbles: true }))

      // Try to preserve cursor position at end of text
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length

      // Show success feedback
      this.optimizeButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Optimized!</span>
      `

      setTimeout(() => {
        this.optimizeButton.innerHTML = originalText
        this.optimizeButton.disabled = false
      }, 1500)

    } catch (error) {
      console.error("Optimization failed:", error)
      this.optimizeButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M15 9L17 11M17 11L16 12M17 11L18 10M11 9L9 11M9 11L8 12M9 11L10 10" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>Error</span>
      `

      setTimeout(() => {
        this.optimizeButton.innerHTML = originalText
        this.optimizeButton.disabled = false
      }, 2000)
    }
  }

  async getContextProfile() {
    // In a real implementation, this would fetch the user's default context profile
    // For now, return null to indicate no context
    return null
  }

  removeOptimizeButton() {
    if (this.optimizeButton && this.optimizeButton.parentNode) {
      this.optimizeButton.parentNode.remove()
      this.optimizeButton = null
    }

    // Remove containers we might have added
    const containers = document.querySelectorAll(`[data-flux-container]`)
    containers.forEach(container => container.remove())
  }
}

// Initialize the optimizer when the script loads
new FluxOptimizer()

// Also reinitialize if the page undergoes major changes (like SPA navigation)
let lastUrl = location.href
new MutationObserver(() => {
  const url = location.href
  if (url !== lastUrl) {
    lastUrl = url
    window.location.reload() // Simple approach for SPA
  }
}).observe(document, { subtree: true, childList: true })