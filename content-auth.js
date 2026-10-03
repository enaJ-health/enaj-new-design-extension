async function grabAndSyncUserId() {
  try {
    const userId = localStorage.getItem("enaj-userId") ||
                   localStorage.getItem("enaj-extension-userId")

    if (!userId || userId === "null" || userId === "undefined") return

    // Check if already synced recently
    const existing = await chrome.storage.local.get(['enajUserId', 'lastSynced'])
    const lastSynced = existing.lastSynced ? new Date(existing.lastSynced) : null
    const hoursSinceSync = lastSynced
      ? (Date.now() - lastSynced.getTime()) / (1000 * 60 * 60)
      : 999

    // Store userId regardless
    chrome.storage.local.set({ enajUserId: userId, enajAutoConnected: true })

    // Only re-fetch full profile if needed
    if (existing.enajUserId === userId && hoursSinceSync < 24) return

    // Fetch full profile from backend
    const res = await fetch(
      `https://enaj-back-production.up.railway.app/api/extension/profile?userId=${userId}`
    )
    if (!res.ok) return

    const data = await res.json()

    await chrome.storage.local.set({
      enajUserId: userId,
      lastSynced: new Date().toISOString(),
      flaggedIngredients: data.flaggedIngredients,
      ailments: data.ailments,
      preferences: data.preferences,
      profileSynced: true,
    })

    // Fetch user name
    const userRes = await fetch(
      `https://enaj-back-production.up.railway.app/api/users/${userId}`
    )
    if (userRes.ok) {
      const userData = await userRes.json()
      const name = userData.user?.firstName
        ? `${userData.user.firstName} ${userData.user.lastName || ''}`.trim()
        : 'Connected'
      await chrome.storage.local.set({ enajUserName: name })
    }

    console.log('[Enaj] Profile synced:', data.ailments?.length, 'ailments,', data.preferences?.length, 'preferences')

  } catch (e) {
    console.log('[Enaj] Sync error:', e)
  }
}

// Run immediately
grabAndSyncUserId()

// Watch for changes (user completes onboarding while extension installed)
const observer = new MutationObserver(() => grabAndSyncUserId())
observer.observe(document.body, { childList: true, subtree: true })

// Check periodically
setInterval(grabAndSyncUserId, 5000)