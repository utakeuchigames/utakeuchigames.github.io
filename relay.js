export async function relay(action, data) {
  try {
    const response = await fetch(`https://yamaki3970.free.nf/api.php?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTPエラー: ${response.status}` };
    }

    const result = await response.json();
    return result;
  } catch (e) {
    return { ok: false, error: "通信エラー: " + e.message };
  }
}
