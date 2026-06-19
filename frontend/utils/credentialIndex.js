const STORAGE_KEY = "ppacvs-cid-index";

export function getCidIndex() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setCidForToken(tokenId, cid) {
  if (typeof window === "undefined") return;
  const current = getCidIndex();
  current[String(tokenId)] = cid;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function getCidForToken(tokenId) {
  const index = getCidIndex();
  return index[String(tokenId)] || "";
}

export function removeCidForToken(tokenId) {
  const current = getCidIndex();
  delete current[String(tokenId)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}
