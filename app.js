const form = document.getElementById("searchForm");
const input = document.getElementById("searchInput");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = input.value.trim();

  if (!query) return;

  // PLACEHOLDER:
  // Later this will route into the psychedelic state archive.
  // Example future route:
  // window.location.href = `archive.html?state=${encodeURIComponent(query)}`;

  console.log("Search:", query);
});
