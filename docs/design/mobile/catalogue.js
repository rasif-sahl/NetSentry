// Bundled by scripts/design/build-mobile-designs.py. This preview never calls an API.
const { screens, navigation } = MOBILE_DESIGNS;
const mainTabs = ["Home", "Usage", "Family", "Computers", "More"];
const params = new URLSearchParams(location.search);
const sheet = params.get("sheet");
let platform = sheet?.startsWith("ios") ? "ios" : "android";
let tab = "Home";
let destination = null;
let variant = 0;
let mode = sheet ? "gallery" : "prototype";
let query = "";
const icons = {
  Home: '<path d="m3 10 9-7 9 7v10H5V10m4 10v-7h6v7"/>',
  Usage: '<path d="M4 20V4m0 16h17M8 17v-6m5 6V6m5 11v-8"/>',
  Family:
    '<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
  Computers:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-5 0h10"/>',
  More: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function routeFor(index) {
  for (const [main, children] of Object.entries(navigation[platform])) {
    for (const [label, indices] of Object.entries(children))
      if (indices.includes(index + 1)) return [main, label];
  }
  return ["More", "Privacy & account"];
}
function items(content) {
  return content
    .map(([type, text]) => {
      if (type === "dialog") {
        const [title, body, confirm, cancel] = text.split("|");
        return `<section class="dialog"><h3>${esc(title)}</h3><p>${esc(body)}</p><footer><span>${esc(cancel)}</span><strong>${esc(confirm)}</strong></footer></section>`;
      }
      return `<div class="item ${type}">${esc(text)}</div>`;
    })
    .join("");
}
function phone({ main, label, screen, menu = false, interactive = false }) {
  const auth = screen?.section.startsWith("Account");
  const link = (text, index) =>
    interactive
      ? `<button class="menu-link" data-dest="${index}"><span>${esc(text)}</span><span aria-hidden="true">›</span></button>`
      : `<div class="menu-link"><span>${esc(text)}</span><span>›</span></div>`;
  const body = menu
    ? Object.keys(navigation[platform][main]).map(link).join("")
    : `<div class="panel">${items(screen.items)}</div>`;
  const bottom = auth
    ? ""
    : `<nav class="bottom" aria-label="Main navigation">${mainTabs.map((name, i) => `<button ${interactive ? `data-tab="${i}"` : 'tabindex="-1"'} ${name === main ? 'aria-current="page"' : ""} class="${name === main ? "active" : ""}"><span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg></span>${name}</button>`).join("")}</nav>`;
  return `<div class="phone ${platform} ${auth ? "auth" : ""}"><div class="status"><span>9:41</span><span>▴ ◔ ▰</span></div><div class="apphead">${!menu && !auth ? (interactive ? `<button class="back" id="back">‹ Back to ${esc(main)}</button>` : `<div class="back">‹ Back to ${esc(main)}</div>`) : ""}<div class="brand">${auth ? "NetSentry" : esc(menu ? main : label)}</div>${auth || menu ? "" : `<div class="caption">${esc(screen.title)}</div>`}</div><div class="content">${body}</div>${bottom}<div class="home"></div></div>`;
}
function saveLocation() {
  if (sheet) return;
  const hash = new URLSearchParams({
    platform,
    tab,
    ...(destination ? { destination } : {}),
  });
  history.pushState(null, "", "#" + hash.toString());
}
function bindNavigation(container) {
  container.querySelectorAll("[data-tab]").forEach(
    (button) =>
      (button.onclick = () => {
        tab = mainTabs[Number(button.dataset.tab)];
        destination = null;
        variant = 0;
        saveLocation();
        render();
      }),
  );
  container.querySelectorAll("[data-dest]").forEach(
    (button) =>
      (button.onclick = () => {
        destination = Object.keys(navigation[platform][tab])[
          Number(button.dataset.dest)
        ];
        variant = 0;
        saveLocation();
        render();
      }),
  );
  container.querySelector("#back")?.addEventListener("click", () => {
    destination = null;
    variant = 0;
    saveLocation();
    render();
  });
}
function render() {
  document.querySelector("#title").textContent =
    `${platform === "android" ? "Android" : "iOS"} · ${sheet ? "Design sheet " + sheet.slice(-1) + " / 2" : "Bottom navigation designs"}`;
  document
    .querySelectorAll("[data-platform]")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.platform === platform),
    );
  document.querySelector("#mode").textContent =
    mode === "prototype" ? "View all screens" : "Try navigation";
  document.querySelector("#search").hidden = mode !== "gallery";
  document.querySelector("#workspace").hidden = mode !== "prototype";
  document.querySelector("#gallery").hidden = mode !== "gallery";
  if (mode === "prototype") {
    const outline = document.querySelector("#outline");
    const count = Object.values(navigation[platform]).reduce(
      (n, rows) => n + Object.keys(rows).length,
      0,
    );
    outline.innerHTML =
      `<h2>5 main tabs · ${count} submenus</h2><p>Choose a bottom tab, then a submenu. Back returns to the tab’s menu. The native apps provide platform Back behavior; this standalone preview also supports browser Back. Form actions are visual examples only.</p>` +
      mainTabs
        .map(
          (name, i) =>
            `<h3><button data-tab="${i}" class="${tab === name ? "active" : ""}">${esc(name)}</button></h3>${Object.keys(
              navigation[platform][name],
            )
              .map(
                (label) =>
                  `<button data-outline="${esc(name)}|${esc(label)}" class="${destination === label ? "active" : ""}">${esc(label)}</button>`,
              )
              .join("")}`,
        )
        .join("");
    bindNavigation(outline);
    outline.querySelectorAll("[data-outline]").forEach(
      (b) =>
        (b.onclick = () => {
          [tab, destination] = b.dataset.outline.split("|");
          variant = 0;
          saveLocation();
          render();
        }),
    );
    const indices = destination ? navigation[platform][tab][destination] : [];
    const screen = destination ? screens[platform][indices[variant] - 1] : null;
    const preview = document.querySelector("#preview");
    preview.innerHTML =
      (indices.length > 1
        ? `<label class="caption" for="variants">Related screen / state</label><select id="variants" class="variants">${indices.map((index, i) => `<option value="${i}" ${i === variant ? "selected" : ""}>${esc(screens[platform][index - 1].title)}</option>`).join("")}</select>`
        : "") +
      phone({
        main: tab,
        label: destination,
        screen,
        menu: !destination,
        interactive: true,
      }) +
      '<p class="caption">Source-based design approximation. Native UI rendering and device validation are pending. No monitoring or remote action occurs in this preview.</p>';
    bindNavigation(preview);
    preview.querySelector("#variants")?.addEventListener("change", (e) => {
      variant = Number(e.target.value);
      render();
    });
  } else {
    let entries = [
      ...mainTabs.map((main) => ({
        title: main + " menu",
        section: "Main tab · submenu landing",
        main,
        menu: true,
      })),
      ...screens[platform].map((screen, index) => ({
        ...screen,
        main: routeFor(index)[0],
        label: routeFor(index)[1],
        screen,
      })),
    ];
    if (sheet)
      entries = entries.slice(
        sheet.endsWith("2") ? 17 : 0,
        sheet.endsWith("2") ? 33 : 17,
      );
    if (query)
      entries = entries.filter((s) =>
        (s.title + " " + s.section).toLowerCase().includes(query),
      );
    document.querySelector("#gallery").innerHTML = entries
      .map(
        (entry, index) =>
          `<article class="entry"><div class="meta">${String(index + 1 + (sheet?.endsWith("2") ? 17 : 0)).padStart(2, "0")} · ${esc(entry.title)}<small>${esc(entry.section)}</small></div>${phone(entry)}<p class="caption">Source-based approximation · ${entry.menu ? "Submenu landing page" : "Page, section or state"} · Light appearance</p></article>`,
      )
      .join("");
  }
}
function restoreLocation() {
  const state = new URLSearchParams(location.hash.slice(1));
  platform = state.get("platform") === "ios" ? "ios" : "android";
  tab = mainTabs.includes(state.get("tab")) ? state.get("tab") : "Home";
  destination = Object.hasOwn(
    navigation[platform][tab],
    state.get("destination"),
  )
    ? state.get("destination")
    : null;
  variant = 0;
}
if (sheet) document.body.classList.add("sheet");
else restoreLocation();
document.querySelectorAll("[data-platform]").forEach(
  (button) =>
    (button.onclick = () => {
      platform = button.dataset.platform;
      tab = "Home";
      destination = null;
      variant = 0;
      saveLocation();
      render();
    }),
);
document.querySelector("#mode").onclick = () => {
  mode = mode === "prototype" ? "gallery" : "prototype";
  render();
};
document.querySelector("#search").oninput = (e) => {
  query = e.target.value;
  render();
};
window.addEventListener("popstate", () => {
  restoreLocation();
  render();
});
render();
