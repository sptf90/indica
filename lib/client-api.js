export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(
      data?.error ||
        (response.status >= 500
          ? "Erro no servidor. Tente de novo."
          : "Falha na requisição")
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
