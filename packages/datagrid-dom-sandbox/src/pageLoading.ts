export function finishDemoLoading(document: Document): void {
  const content = document.querySelector<HTMLElement>("[data-demo-content]")
  if (content) {
    content.removeAttribute("inert")
    content.removeAttribute("aria-hidden")
    content.setAttribute("aria-busy", "false")
  }
  document.querySelector("#page-loading")?.remove()
}

export function failDemoLoading(document: Document): void {
  const overlay = document.querySelector<HTMLElement>("#page-loading")
  if (!overlay) return

  overlay.dataset.state = "error"
  overlay.setAttribute("role", "alert")
  overlay.setAttribute("aria-live", "assertive")
  overlay.replaceChildren()
  overlay.textContent = "DataGrid could not start. Reload the page to try again."
}
