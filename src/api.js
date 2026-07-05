export async function api(path) {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Request failed: ${response.status}`);
  return response.json();
}
