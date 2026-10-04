(function () {
  const pages = {
    "obchodni-podminky": "obchodni-podminky.html",
    "reklamacni-rad": "reklamace.html",
    odstoupeni: "odstoupeni.html",
    soukromi: "ochrana-osobnich-udaju.html",
    cookies: "cookies.html",
  };
  const page = pages[new URLSearchParams(location.search).get("doc")];
  if (page) location.replace(page + location.hash);
})();
