async function main(): Promise<void> {
  const response = await fetch("https://jsonplaceholder.typicode.com/todos/1");

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { id: number; title: string; completed: boolean };
  console.log("Fetched todo:", data);
}

main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
