// Description: Copy the current view (URL + a one-line caption) for sharing.

/**
 * Copies a caption and URL to the clipboard.
 * @returns Whether the write succeeded
 */
export async function copyShare(caption: string, url: string): Promise<boolean> {
  const text = `${caption}\n${url}`
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
