/* Foxalora website: header, theme, mobile menu, scroll reveal, setup wizard, contact form. */
(function () {
  var root = document.documentElement;
  root.classList.remove("no-js");

  // Theme: remembered per visitor; falls back to the device setting.
  var THEME_KEY = "foxalora-site-theme";
  try { var saved = localStorage.getItem(THEME_KEY); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
  function isDark() {
    var t = root.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  });

  // Header border on scroll
  var nav = document.querySelector(".nav");
  function onScroll() { if (nav) nav.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // Mobile menu
  var menuBtn = document.querySelector(".menu-btn");
  var menu = document.querySelector(".mobile-menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
  }

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Reveal on scroll
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -60px 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }

  // Setup wizard demo (get-started page)
  var wizard = document.querySelector("[data-wizard]");
  if (wizard) {
    var steps = Array.prototype.slice.call(wizard.querySelectorAll(".wz-steps button"));
    var panes = Array.prototype.slice.call(wizard.querySelectorAll(".wz-pane"));
    var back = wizard.querySelector("[data-back]");
    var next = wizard.querySelector("[data-next]");
    var bar = wizard.querySelector(".wz-progress i");
    var current = 0;
    function show(i) {
      current = Math.max(0, Math.min(panes.length - 1, i));
      panes.forEach(function (p, n) { p.classList.toggle("on", n === current); });
      steps.forEach(function (s, n) {
        if (n === current) s.setAttribute("aria-current", "step"); else s.removeAttribute("aria-current");
        s.classList.toggle("done", n < current);
      });
      if (bar) bar.style.width = ((current + 1) / panes.length) * 100 + "%";
      back.disabled = current === 0;
      next.textContent = current === panes.length - 1 ? "Start over" : current === panes.length - 2 ? "Finish setup" : "Continue";
      var name = wizard.querySelector("#wz-name");
      wizard.querySelectorAll("[data-app-name]").forEach(function (el) { el.textContent = (name && name.value.trim()) || "Foxalora"; });
    }
    steps.forEach(function (s, n) { s.addEventListener("click", function () { show(n); }); });
    back.addEventListener("click", function () { show(current - 1); });
    next.addEventListener("click", function () { show(current === panes.length - 1 ? 0 : current + 1); });
    var color = wizard.querySelector("#wz-color");
    var preview = wizard.querySelector("[data-brand-preview]");
    if (color && preview) color.addEventListener("input", function () { preview.style.background = color.value; });
    show(0);
  }

  // Contact form: opens the visitor's email app (no data is sent anywhere else).
  var form = document.querySelector("[data-contact]");
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = new FormData(form);
      var body = "Name: " + f.get("name") + "\nCompany: " + (f.get("company") || "-") + "\nMailboxes: " + (f.get("size") || "-") + "\n\n" + f.get("message");
      window.location.href = "mailto:" + form.getAttribute("data-to") + "?subject=" + encodeURIComponent("Foxalora: " + f.get("topic")) + "&body=" + encodeURIComponent(body);
      var ok = document.querySelector(".form-ok");
      if (ok) ok.classList.add("show");
    });
  }
})();
